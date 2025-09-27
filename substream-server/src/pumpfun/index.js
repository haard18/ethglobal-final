/*
Substream Pumpfun events collector
Continuously monitors Pumpfun events on Solana blockchain and saves to database
*/
import { createConnectTransport } from "@connectrpc/connect-node";
import {
  createRegistry,
  createRequest,
  streamBlocks,
  fetchSubstream,
  createAuthInterceptor as createSubstreamsAuthInterceptor
} from "@substreams/core";
import dotenv from "dotenv";
import { savePumpfunEvent } from "../db/index.js";

dotenv.config();

// Pumpfun Substreams configuration for Solana
const ENDPOINT = "https://mainnet.sol.streamingfast.io";
const SPKG = "https://spkg.io/0xpapercut/pumpfun-events-v0.1.7.spkg";
const MODULE = "pumpfun_events";
const START_BLOCK = "305000000"; // More recent block for Pumpfun activity
const STOP_BLOCK = "+100"; // Smaller range for testing
const TOKEN = process.env.SUBSTREAMS_API_TOKEN;

// Function to fetch the Pumpfun substreams package
const fetchPackage = async () => {
  try {
    console.log("Fetching Pumpfun substream package from:", SPKG);
    const pkg = await fetchSubstream(SPKG);
    console.log("Package modules available:", pkg.modules?.modules?.map(m => m.name) || 'No modules found');
    return pkg;
  } catch (error) {
    console.error("Error fetching Pumpfun package:", error);
    console.error("Check if the package URL is correct:", SPKG);
    console.error("Check if your SUBSTREAMS_API_TOKEN is valid");
    throw error;
  }
};

// Function to get cursor (for resuming streams)
const getCursor = () => {
  // In production, you'd load this from persistent storage
  return null;
};

// Function to handle Pumpfun event data from substream
const handlePumpfunEvents = async (blockScopedData, registry) => {
  try {
    const blockNumber = blockScopedData.clock?.number || 'unknown';
    const blockHash = blockScopedData.clock?.id || '';
    const blockTimestamp = new Date(Number(blockScopedData.clock?.timestamp?.seconds || 0) * 1000).toISOString();
    
    console.log(`Processing Pumpfun events for block ${blockNumber}...`);
    
    // Extract the mapOutput from the BlockScopedData
    const mapOutput = blockScopedData.output?.mapOutput;
    
    if (!mapOutput || !mapOutput.value) {
      console.log("No mapOutput found in block data");
      return;
    }
    
    console.log(`Map output type: ${mapOutput.typeUrl}`);
    console.log(`Map output buffer size: ${mapOutput.value?.length || 0} bytes`);
    
    // The mapOutput contains the actual Pumpfun events as protobuf binary data
    if (mapOutput.typeUrl === 'type.googleapis.com/pumpfun.PumpfunBlockEvents' && mapOutput.value) {
      console.log(`Found Pumpfun events data (${mapOutput.value.length} bytes)`);
      
      try {
        // Decode the protobuf using the registry
        const messageType = registry.findMessage('pumpfun.PumpfunBlockEvents');
        if (!messageType) {
          console.error("Could not find PumpfunBlockEvents message type in registry");
          return;
        }
        
        // Decode the binary protobuf data
        const pumpfunBlockEvents = messageType.fromBinary(mapOutput.value);
        console.log(`Decoded Pumpfun block events:`, Object.keys(pumpfunBlockEvents));
        
        // Process transaction events - check both possible field names
        const transactions = pumpfunBlockEvents.transactions || pumpfunBlockEvents.transactionEvents || [];
        
        if (transactions.length > 0) {
          console.log(`Found ${transactions.length} transaction events`);
          
          for (const txEvent of transactions) {
            await processPumpfunTransactionEvent(txEvent, blockNumber, blockHash, blockTimestamp);
          }
        } else {
          console.log(`No transaction events found in this block (checked ${Object.keys(pumpfunBlockEvents).join(', ')})`);
          
          // Debug: Let's see what's actually in the decoded data
          if (Object.keys(pumpfunBlockEvents).length > 0) {
            console.log("Debug - Available fields in decoded data:", Object.keys(pumpfunBlockEvents));
            
            // Try to access the transactions field and see what's in it
            if (pumpfunBlockEvents.transactions !== undefined) {
              console.log(`Transactions field type: ${typeof pumpfunBlockEvents.transactions}`);
              console.log(`Transactions field length: ${pumpfunBlockEvents.transactions?.length || 'N/A'}`);
              
              if (Array.isArray(pumpfunBlockEvents.transactions) && pumpfunBlockEvents.transactions.length > 0) {
                console.log("First transaction keys:", Object.keys(pumpfunBlockEvents.transactions[0]));
              }
            }
          }
        }
        
        // Process any other events if they exist in the structure
        if (pumpfunBlockEvents.events && pumpfunBlockEvents.events.length > 0) {
          console.log(`Found ${pumpfunBlockEvents.events.length} other events`);
          
          for (const event of pumpfunBlockEvents.events) {
            await processPumpfunEvent(event, {
              number: blockNumber,
              hash: blockHash,
              timestamp: blockTimestamp
            }, 'direct_event');
          }
        }
        
      } catch (decodeError) {
        console.error("Error decoding Pumpfun protobuf data:", decodeError);
        console.log("Falling back to raw data storage...");
        
        // Fallback: store raw data for debugging
        const eventData = {
          eventType: 'pumpfun_raw_data',
          blockNumber: Number(blockNumber),
          blockHash: blockHash,
          transactionHash: `block_${blockNumber}_raw`,
          logIndex: 0,
          tokenAddress: 'unknown',
          user: 'unknown',
          amount: '0',
          solAmount: '0',
          timestamp: blockTimestamp,
          metadata: {
            dataSize: mapOutput.value.length,
            typeUrl: mapOutput.typeUrl,
            blockId: blockHash,
            rawDataAvailable: true,
            decodeError: decodeError.message
          }
        };

        await savePumpfunEvent(eventData);
      }
    } else {
      console.log("No Pumpfun events protobuf data found or wrong type");
    }
  } catch (error) {
    console.error("Error handling Pumpfun events:", error);
  }
};

// Function to process Pumpfun transaction events (PumpfunTransactionEvents)
const processPumpfunTransactionEvent = async (txEvent, blockNumber, blockHash, blockTimestamp) => {
  try {
    const signature = txEvent.signature || '';
    console.log(`Processing transaction ${signature} with ${txEvent.events?.length || 0} events`);
    
    if (!txEvent.events || txEvent.events.length === 0) {
      console.log(`No events in transaction ${signature}`);
      return;
    }
    
    // Process each event within the transaction
    for (let i = 0; i < txEvent.events.length; i++) {
      const event = txEvent.events[i];
      await processPumpfunEventFromTransaction(event, signature, i, blockNumber, blockHash, blockTimestamp);
    }
    
  } catch (error) {
    console.error("Error processing Pumpfun transaction event:", error);
  }
};

// Function to process individual events from transactions
const processPumpfunEventFromTransaction = async (event, signature, eventIndex, blockNumber, blockHash, blockTimestamp) => {
  try {
    // Determine event type based on the event structure
    let eventType = 'unknown';
    let eventData = null;
    
    // Handle the actual event structure - the event is nested under 'event' field
    if (event.event) {
      const actualEvent = event.event;
      console.log(`Processing nested event with keys:`, Object.keys(actualEvent));
      
      // Check if this is a SwapEvent
      if (actualEvent.swapEvent || actualEvent.swap_event) {
        eventType = 'swap';
        const swapEvent = actualEvent.swapEvent || actualEvent.swap_event;
        eventData = await processSwapEvent(swapEvent, signature, eventIndex, blockNumber, blockHash, blockTimestamp);
      }
      // Check for create events
      else if (actualEvent.createEvent || actualEvent.create_event) {
        eventType = 'create';
        const createEvent = actualEvent.createEvent || actualEvent.create_event;
        eventData = await processCreateEvent(createEvent, signature, eventIndex, blockNumber, blockHash, blockTimestamp);
      }
      // Check for transfer events
      else if (actualEvent.transferEvent || actualEvent.transfer_event) {
        eventType = 'transfer';
        const transferEvent = actualEvent.transferEvent || actualEvent.transfer_event;
        eventData = await processTransferEvent(transferEvent, signature, eventIndex, blockNumber, blockHash, blockTimestamp);
      }
      // Check for other possible event types
      else if (actualEvent.tradeEvent || actualEvent.trade_event) {
        eventType = 'trade';
        const tradeEvent = actualEvent.tradeEvent || actualEvent.trade_event;
        eventData = await processSwapEvent(tradeEvent, signature, eventIndex, blockNumber, blockHash, blockTimestamp);
      }
      else {
        console.log(`Unknown nested event type in transaction ${signature}, event ${eventIndex}`);
        console.log("Nested event keys:", Object.keys(actualEvent));
        
        // Try to extract any useful data from the nested event
        eventData = await processGenericEvent(actualEvent, signature, eventIndex, blockNumber, blockHash, blockTimestamp);
      }
    }
    else {
      console.log(`No 'event' field found in transaction ${signature}, event ${eventIndex}`);
      console.log("Available fields:", Object.keys(event));
      
      // Try processing as a direct event
      eventData = await processGenericEvent(event, signature, eventIndex, blockNumber, blockHash, blockTimestamp);
    }
    
    if (eventData) {
      await savePumpfunEvent(eventData);
      console.log(`✅ Pumpfun ${eventType} event saved - TX: ${signature.slice(0, 8)}...`);
    }
    
  } catch (error) {
    console.error("Error processing individual Pumpfun event:", error);
  }
};

// Function to process SwapEvent according to protobuf schema
const processSwapEvent = async (swapEvent, signature, eventIndex, blockNumber, blockHash, blockTimestamp) => {
  try {
    const user = swapEvent.user || '';
    const mint = swapEvent.mint || '';
    const bondingCurve = swapEvent.bondingCurve || swapEvent.bonding_curve || '';
    const solAmount = swapEvent.solAmount || swapEvent.sol_amount || '0';
    const tokenAmount = swapEvent.tokenAmount || swapEvent.token_amount || '0';
    const direction = swapEvent.direction || 'unknown'; // 'buy' or 'sell'
    
    const eventData = {
      eventType: `swap_${direction}`,
      blockNumber: Number(blockNumber),
      blockHash: blockHash,
      transactionHash: signature,
      logIndex: eventIndex,
      tokenAddress: mint,
      user: user,
      amount: tokenAmount.toString(),
      solAmount: solAmount.toString(),
      timestamp: blockTimestamp,
      metadata: {
        bondingCurve: bondingCurve,
        direction: direction,
        virtualSolReserves: (swapEvent.virtualSolReserves || swapEvent.virtual_sol_reserves || '0').toString(),
        virtualTokenReserves: (swapEvent.virtualTokenReserves || swapEvent.virtual_token_reserves || '0').toString(),
        realSolReserves: (swapEvent.realSolReserves || swapEvent.real_sol_reserves || '0').toString(),
        realTokenReserves: (swapEvent.realTokenReserves || swapEvent.real_token_reserves || '0').toString(),
        userTokenPreBalance: (swapEvent.userTokenPreBalance || swapEvent.user_token_pre_balance || '0').toString(),
        eventType: 'swap'
      }
    };
    
    console.log(`📈 Swap Event: ${direction} ${tokenAmount} tokens for ${solAmount} SOL - User: ${user.slice(0, 8)}... Token: ${mint.slice(0, 8)}...`);
    
    return eventData;
  } catch (error) {
    console.error("Error processing swap event:", error);
    return null;
  }
};

// Function to process CreateEvent (if exists in protobuf)
const processCreateEvent = async (createEvent, signature, eventIndex, blockNumber, blockHash, blockTimestamp) => {
  try {
    const eventData = {
      eventType: 'create',
      blockNumber: Number(blockNumber),
      blockHash: blockHash,
      transactionHash: signature,
      logIndex: eventIndex,
      tokenAddress: createEvent.mint || createEvent.token || '',
      user: createEvent.creator || createEvent.user || '',
      amount: '0',
      solAmount: (createEvent.initialSol || createEvent.initial_sol || '0').toString(),
      timestamp: blockTimestamp,
      metadata: {
        eventType: 'create',
        rawCreateEvent: JSON.stringify(createEvent)
      }
    };
    
    console.log(`🎯 Create Event: New token ${eventData.tokenAddress} created by ${eventData.user.slice(0, 8)}...`);
    
    return eventData;
  } catch (error) {
    console.error("Error processing create event:", error);
    return null;
  }
};

// Function to process TransferEvent (if exists in protobuf)
const processTransferEvent = async (transferEvent, signature, eventIndex, blockNumber, blockHash, blockTimestamp) => {
  try {
    const eventData = {
      eventType: 'transfer',
      blockNumber: Number(blockNumber),
      blockHash: blockHash,
      transactionHash: signature,
      logIndex: eventIndex,
      tokenAddress: transferEvent.mint || transferEvent.token || '',
      user: transferEvent.from || transferEvent.to || '',
      amount: (transferEvent.amount || '0').toString(),
      solAmount: '0',
      timestamp: blockTimestamp,
      metadata: {
        from: transferEvent.from || '',
        to: transferEvent.to || '',
        eventType: 'transfer',
        rawTransferEvent: JSON.stringify(transferEvent)
      }
    };
    
    console.log(`🔄 Transfer Event: ${eventData.amount} tokens - From: ${transferEvent.from?.slice(0, 8)}... To: ${transferEvent.to?.slice(0, 8)}...`);
    
    return eventData;
  } catch (error) {
    console.error("Error processing transfer event:", error);
    return null;
  }
};

// Function to process individual Pumpfun events
const processPumpfunEvent = async (event, blockData, sourceKey = '') => {
  try {
    console.log(`Processing event from ${sourceKey}:`, JSON.stringify(event, null, 2));
    
    // Extract event data based on Pumpfun event types
    // Try different possible field names based on the protobuf structure
    const eventData = {
      eventType: event.type || event.eventType || event.action || event.instruction_type || 'unknown',
      blockNumber: blockData.number || blockData.block_number || 0,
      blockHash: blockData.hash || blockData.block_hash || '',
      transactionHash: event.transactionHash || event.transaction_hash || event.txHash || event.signature || 'unknown',
      logIndex: event.logIndex || event.log_index || event.index || 0,
      
      // Pumpfun specific fields (these will depend on the actual protobuf structure)
      tokenAddress: event.tokenAddress || event.token_address || event.mint || event.token_mint || event.coin || '',
      user: event.user || event.trader || event.account || event.user_wallet || event.buyer || event.seller || '',
      amount: (event.amount || event.token_amount || event.coin_amount || '0').toString(),
      solAmount: (event.solAmount || event.sol_amount || event.lamports || event.price || '0').toString(),
      timestamp: blockData.timestamp || event.timestamp || new Date().toISOString(),
      
      // Additional metadata
      metadata: {
        programId: event.programId || event.program_id || '',
        accounts: event.accounts || event.account_keys || [],
        instruction: event.instruction || event.instruction_type || event.action || '',
        sourceKey: sourceKey,
        rawData: JSON.stringify(event)
      }
    };

    // Only save if we have essential data
    if (eventData.tokenAddress || eventData.user || eventData.amount !== '0') {
      await savePumpfunEvent(eventData);
      console.log(`✅ Pumpfun event saved - Type: ${eventData.eventType}, Token: ${eventData.tokenAddress}, User: ${eventData.user}`);
    } else {
      console.log(`⚠️ Skipping event due to insufficient data:`, eventData);
    }
  } catch (error) {
    console.error("Error processing Pumpfun event:", error);
    console.error("Event data:", event);
  }
};

// Function to handle block scoped data messages from Pumpfun substream
const handleBlockScopedDataMessage = async (blockScopedData, registry) => {
  try {
    // Handle Pumpfun events
    if (blockScopedData && typeof blockScopedData === 'object') {
      await handlePumpfunEvents(blockScopedData, registry);
    } else {
      console.log("Unexpected block scoped data format");
    }
  } catch (error) {
    console.error("Error handling block scoped data message:", error);
  }
};

// Function to handle block undo signal messages
const handleBlockUndoSignalMessage = (blockUndoSignal) => {
  console.log(`Received block undo signal for Pumpfun block ${blockUndoSignal.blockNumber}`);
  // Handle reorgs - in production you might want to remove/mark affected events
};

// Function to handle progress messages
const handleProgressMessage = (progress, registry) => {
  if (progress.processedBlocks % 10 === 0) {
    console.log(`Pumpfun Progress: Processed ${progress.processedBlocks} blocks`);
  }
};

// Function to check if error is retryable
const isErrorRetryable = (error) => {
  return (
    error.code === "UNAVAILABLE" ||
    error.code === "DEADLINE_EXCEEDED" ||
    error.message.includes("connection") ||
    error.message.includes("timeout")
  );
};

export const handleResponseMessage = async (response, registry) => {
  switch(response.message.case) {
    case "blockScopedData":
      await handleBlockScopedDataMessage(response.message.value, registry);
      break;
    case "blockUndoSignal":
      handleBlockUndoSignalMessage(response.message.value);
      break;
  }
};

// Main streaming function for Pumpfun events
const stream = async (pkg, registry, transport) => {
  const request = createRequest({
    substreamPackage: pkg,
    outputModule: MODULE,
    productionMode: true,
    startBlockNum: START_BLOCK,
    stopBlockNum: STOP_BLOCK,
    startCursor: getCursor() ?? undefined,
  });

  console.log(`Starting Pumpfun stream from block ${START_BLOCK} to ${STOP_BLOCK}`);

  // Stream the blocks
  for await (const statefulResponse of streamBlocks(transport, request)) {
    await handleResponseMessage(statefulResponse.response, registry);
    handleProgressMessage(statefulResponse.progress, registry);
  }
};

/*
  Main entrypoint for Pumpfun events streaming
*/
export const startPumpfunEventStream = async () => {
  console.log('Starting Pumpfun events stream...');

  const pkg = await fetchPackage();
  const registry = createRegistry(pkg);

  // Create gRPC connection to Solana endpoint
  const transport = createConnectTransport({
    baseUrl: ENDPOINT,
    interceptors: [createSubstreamsAuthInterceptor(TOKEN)],
    useBinaryFormat: true,
    jsonOptions: {
      typeRegistry: registry,
    },
  });

  console.log('Connected to Solana Substreams endpoint for Pumpfun events');

  // Infinite loop handles disconnections and reconnects automatically
  while (true) {
    try {
      await stream(pkg, registry, transport);
    } catch (e) {
      if (!isErrorRetryable(e)) {
        console.log(`A fatal error occurred in Pumpfun stream: ${e}`);
        throw e;
      }
      console.log(`A retryable error occurred in Pumpfun stream (${e}), retrying after backoff`);
      console.log(e);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

// Only start streaming if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startPumpfunEventStream();
}
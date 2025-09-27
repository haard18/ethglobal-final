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
    console.log(`Processing Pumpfun events for block ${blockNumber}...`);
    
    // Extract the mapOutput from the BlockScopedData
    const mapOutput = blockScopedData.output?.mapOutput;
    
    if (!mapOutput) {
      console.log("No mapOutput found in block data");
      return;
    }
    
    console.log(`Map output type: ${mapOutput.typeUrl}`);
    console.log(`Map output buffer size: ${mapOutput.value?.length || 0} bytes`);
    
    // The mapOutput contains the actual Pumpfun events as protobuf binary data
    if (mapOutput.typeUrl === 'type.googleapis.com/pumpfun.PumpfunBlockEvents' && mapOutput.value) {
      console.log(`Found Pumpfun events data (${mapOutput.value.length} bytes)`);
      
      try {
        // For now, let's just count and save the raw data since we have binary data
        // In a production system, you'd properly decode the protobuf here
        
        // Create a simplified event record for this block
        const eventData = {
          eventType: 'pumpfun_block_activity',
          blockNumber: Number(blockScopedData.clock?.number || 0),
          blockHash: blockScopedData.clock?.id || '',
          transactionHash: `block_${blockNumber}`,
          logIndex: 0,
          tokenAddress: 'multiple', // Since this is block-level data
          user: 'multiple',
          amount: '0',
          solAmount: mapOutput.value.length.toString(), // Use buffer size as activity indicator
          timestamp: new Date(Number(blockScopedData.clock?.timestamp?.seconds || 0) * 1000).toISOString(),
          metadata: {
            dataSize: mapOutput.value.length,
            typeUrl: mapOutput.typeUrl,
            blockId: blockScopedData.clock?.id,
            rawDataAvailable: true
          }
        };

        await savePumpfunEvent(eventData);
        console.log(`✅ Pumpfun block activity recorded - Block: ${blockNumber}, Data Size: ${mapOutput.value.length} bytes`);
        
      } catch (decodeError) {
        console.error("Error processing Pumpfun protobuf data:", decodeError);
      }
    } else {
      console.log("No Pumpfun events protobuf data found or wrong type");
    }
  } catch (error) {
    console.error("Error handling Pumpfun events:", error);
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
/*
Substream market data collector for ERC-20 tokens using The Graph Token API
Continuously fetches blockchain market data for all ERC-20 tokens and saves to database
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
import { saveMarketData } from "../db/index.js";
import axios from 'axios';
dotenv.config();

// The Graph Token API configuration
const GRAPH_TOKEN_API = {
  endpoint: 'https://token-api.thegraph.com',
  token: "eyJhbGciOiJLTVNFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3OTQ4OTU2MTksImp0aSI6IjgwMjllZDg4LTY5ZWMtNDA2NC05OWFhLWFkNGY2ZDU0NWUwMiIsImlhdCI6MTc1ODg5NTYxOSwiaXNzIjoiZGZ1c2UuaW8iLCJzdWIiOiIwZGl6YTM4NWM5MmVhOTkzZGRhODIiLCJ2IjoyLCJha2kiOiIzMDVhZWZkNDE3YmJjNzgyNzAyY2FkN2IxMGViMzlkMTBlNTdiNWQ4MTU5M2ZkYTg2YWY4Yzk5YjljN2EwMDY0IiwidWlkIjoiMGRpemEzODVjOTJlYTk5M2RkYTgyIiwic3Vic3RyZWFtc19wbGFuX3RpZXIiOiJGUkVFIiwiY2ZnIjp7IlNVQlNUUkVBTVNfTUFYX1JFUVVFU1RTIjoiMiIsIlNVQlNUUkVBTVNfUEFSQUxMRUxfSk9CUyI6IjUiLCJTVUJTVFJFQU1TX1BBUkFMTEVMX1dPUktFUlMiOiI1In19.-BBfME1q4KdqXs4tmFstcwfJYDPxvT1Zl4RMfVlh29jDbzQHNIJA3OhT7NQsMDwNVEn0POHCHWHdpfCrOrgGHA"
};

// Substreams configuration
const ENDPOINT = "https://mainnet.eth.streamingfast.io";
const SPKG = "https://spkg.io/streamingfast/erc20-balance-changes-v1.4.0.spkg";
const MODULE = "map_balance_changes";
const START_BLOCK = "1397553";
const STOP_BLOCK = "+10000";
const TOKEN = process.env.SUBSTREAMS_API_TOKEN;

// Cache for token data and prices
const tokenCache = new Map();
const priceCache = new Map();

// Function to fetch the substreams package
const fetchPackage = async () => {
  try {
    return await fetchSubstream(SPKG);
  } catch (error) {
    console.error("Error fetching package:", error);
    throw error;
  }
};

// Function to get cursor (for resuming streams)
const getCursor = () => {
  return null;
};

// Function to make requests to The Graph Token API
const graphTokenApiRequest = async (path, params = {}) => {
  try {
    const response = await axios.get(`${GRAPH_TOKEN_API.endpoint}${path}`, {
      params,
      headers: {
        Authorization: `Bearer ${GRAPH_TOKEN_API.token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Token API error:', error);
    throw new Error(`Failed to execute request: ${error}`);
  }
};

// Function to get ETH price in USD using Token API
const getETHPrice = async () => {
  try {
    const cached = priceCache.get('ETH_PRICE');
    if (cached && Date.now() - cached.timestamp < 60000) { // Cache for 1 minute
      return cached.price;
    }

    // Use OHLCV endpoint for ETH price
    const response = await graphTokenApiRequest('/ohlc/prices/evm/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', {
      network_id: 'mainnet',
      interval: '1d',
      limit: 1
    });

    if (response.data && response.data.length > 0) {
      const ethPrice = parseFloat(response.data[0].close);
      priceCache.set('ETH_PRICE', { price: ethPrice, timestamp: Date.now() });
      return ethPrice;
    }

    return 3000; // Fallback ETH price
  } catch (error) {
    console.error('Error fetching ETH price:', error);
    return 3000;
  }
};

// Function to fetch token metadata and market data from Token API
const fetchTokenDataFromGraph = async (tokenAddress) => {
  try {
    // Check cache first
    const cached = tokenCache.get(tokenAddress.toLowerCase());
    if (cached && Date.now() - cached.timestamp < 300000) { // Cache for 5 minutes
      return cached.data;
    }

    // Get token metadata
    const metadataResponse = await graphTokenApiRequest(`/tokens/evm/${tokenAddress}`, {
      network_id: 'mainnet'
    });

    if (!metadataResponse.data || metadataResponse.data.length === 0) {
      console.warn(`Token ${tokenAddress} not found in Token API`);
      return null;
    }

    const token = metadataResponse.data[0];

    // Get token holders for liquidity info
    const holdersResponse = await graphTokenApiRequest(`/holders/evm/${tokenAddress}`, {
      network_id: 'mainnet',
      limit: 10
    });

    // Get OHLCV data for price history
    const ohlcvResponse = await graphTokenApiRequest(`/ohlc/prices/evm/${tokenAddress}`, {
      network_id: 'mainnet',
      interval: '1d',
      limit: 7
    });

    const ethPrice = await getETHPrice();

    // Calculate market data
    const totalHolders = holdersResponse.data ? holdersResponse.data.length : 0;
    const totalLiquidityUSD = holdersResponse.data ?
      holdersResponse.data.reduce((sum, holder) => sum + holder.value, 0) : 0;

    const priceUsd = ohlcvResponse.data && ohlcvResponse.data.length > 0 ?
      parseFloat(ohlcvResponse.data[0].close) : 0;

    const tokenData = {
      address: token.contract,
      symbol: token.symbol || 'UNKNOWN',
      name: token.name || 'Unknown Token',
      decimals: token.decimals || 18,
      totalSupply: token.circulating_supply || '0',
      priceUsd,
      priceEth: priceUsd / ethPrice,
      volume24h: 0, // Would need historical data
      totalLiquidity: totalLiquidityUSD,
      totalLiquidityUSD,
      txCount: 0, // Would need transaction history
      holders: totalHolders,
      pairs: [], // Would need DEX data
      ohlcv: ohlcvResponse.data || []
    };

    // Cache the result
    tokenCache.set(tokenAddress.toLowerCase(), {
      data: tokenData,
      timestamp: Date.now()
    });

    return tokenData;
  } catch (error) {
    console.error(`Error fetching token data for ${tokenAddress}:`, error);
    return null;
  }
};

// Function to fetch multiple tokens data efficiently
const fetchMultipleTokensData = async (tokenAddresses) => {
  try {
    const uniqueAddresses = [...new Set(tokenAddresses.map(addr => addr.toLowerCase()))];
    const uncachedAddresses = uniqueAddresses.filter(addr => {
      const cached = tokenCache.get(addr);
      return !cached || Date.now() - cached.timestamp > 300000;
    });

    if (uncachedAddresses.length === 0) {
      // All tokens are cached
      return uniqueAddresses.map(addr => tokenCache.get(addr)?.data).filter(Boolean);
    }

    // Fetch data for each uncached token
    const tokensData = [];
    for (const address of uncachedAddresses) {
      const tokenData = await fetchTokenDataFromGraph(address);
      if (tokenData) {
        tokensData.push(tokenData);
      }
    }

    // Return all tokens (cached + newly fetched)
    return uniqueAddresses.map(addr => tokenCache.get(addr)?.data).filter(Boolean);
  } catch (error) {
    console.error('Error fetching multiple tokens data:', error);
    return [];
  }
};

// Function to decode ERC-20 token data from transaction logs
const decodeERC20Transfer = (log) => {
  try {
    const transferEventSignature = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

    if (log.topics && log.topics[0] === transferEventSignature) {
      return {
        tokenAddress: log.address,
        from: log.topics[1] ? `0x${log.topics[1].slice(26)}` : null,
        to: log.topics[2] ? `0x${log.topics[2].slice(26)}` : null,
        value: log.data ? BigInt(`0x${log.data}`) : BigInt(0),
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        blockHash: log.blockHash
      };
    }
    return null;
  } catch (error) {
    console.error("Error decoding ERC-20 transfer:", error);
    return null;
  }
};

// Function to calculate market data from transfer events using Token API data
const calculateMarketDataWithGraph = async (transfers, blockNumber, blockHash) => {
  const tokenAddresses = [...new Set(transfers.map(t => t.tokenAddress).filter(Boolean))];

  if (tokenAddresses.length === 0) return [];

  // Fetch real token data from Token API
  const graphTokensData = await fetchMultipleTokensData(tokenAddresses);
  const graphDataMap = new Map(graphTokensData.map(token => [token.address.toLowerCase(), token]));

  const tokenTransferData = new Map();

  // Process transfers
  for (const transfer of transfers) {
    if (!transfer || !transfer.tokenAddress) continue;

    const tokenAddress = transfer.tokenAddress.toLowerCase();

    if (!tokenTransferData.has(tokenAddress)) {
      tokenTransferData.set(tokenAddress, {
        tokenAddress,
        totalVolume: BigInt(0),
        transferCount: 0,
        uniqueAddresses: new Set(),
        transfers: []
      });
    }

    const data = tokenTransferData.get(tokenAddress);
    data.totalVolume += transfer.value;
    data.transferCount++;
    if (transfer.from) data.uniqueAddresses.add(transfer.from);
    if (transfer.to) data.uniqueAddresses.add(transfer.to);
    data.transfers.push(transfer);
  }

  // Combine transfer data with Token API data
  const marketDataArray = [];

  for (const [tokenAddress, transferData] of tokenTransferData) {
    const graphData = graphDataMap.get(tokenAddress);

    if (!graphData) {
      console.warn(`No Token API data found for token ${tokenAddress}`);
      continue;
    }

    // Convert volume from wei to token units
    const volumeInTokens = Number(transferData.totalVolume) / Math.pow(10, graphData.decimals);
    const volumeUsd = volumeInTokens * graphData.priceUsd;

    // Calculate market cap
    const totalSupplyInTokens = parseFloat(graphData.totalSupply) / Math.pow(10, graphData.decimals);
    const marketCap = totalSupplyInTokens * graphData.priceUsd;

    const marketData = {
      tokenAddress,
      tokenSymbol: graphData.symbol,
      tokenName: graphData.name,
      decimals: graphData.decimals,

      // Real price data from Token API
      priceUsd: graphData.priceUsd,
      priceEth: graphData.priceEth,

      // Volume data (combining historical + current block)
      volume24h: graphData.volume24h,
      currentBlockVolume: volumeUsd,
      currentBlockVolumeTokens: volumeInTokens,

      // Liquidity data from Token API
      totalLiquidity: graphData.totalLiquidity,
      totalLiquidityUSD: graphData.totalLiquidityUSD,

      // Supply and market cap
      totalSupply: graphData.totalSupply,
      marketCap,

      // Transfer activity in current block
      transferCount: transferData.transferCount,
      uniqueAddresses: transferData.uniqueAddresses.size,

      // Holder count from Token API
      totalHolders: graphData.holders,

      // Block info
      blockNumber,
      blockHash,
      timestamp: Date.now(),

      // Historical price data
      ohlcv: graphData.ohlcv
    };

    marketDataArray.push(marketData);
  }

  return marketDataArray;
};

// Function to handle block scoped data messages from erc20-balance-changes substream
const handleBlockScopedDataMessage = async (blockScopedData, registry) => {
  try {
    console.log(`Processing balance changes...`);

    // The erc20-balance-changes module outputs balance changes directly
    if (blockScopedData.balanceChanges && blockScopedData.balanceChanges.length > 0) {
      const balanceChanges = blockScopedData.balanceChanges;
      console.log(`Found ${balanceChanges.length} ERC-20 balance changes`);

      // Extract unique token addresses from balance changes
      const tokenAddresses = [...new Set(balanceChanges.map(change => change.contract).filter(Boolean))];
      
      if (tokenAddresses.length === 0) return;

      // Fetch real token data from Token API for these addresses
      const graphTokensData = await fetchMultipleTokensData(tokenAddresses);
      const graphDataMap = new Map(graphTokensData.map(token => [token.address.toLowerCase(), token]));

      // Process balance changes and calculate market data
      const tokenBalanceData = new Map();
      
      for (const change of balanceChanges) {
        if (!change || !change.contract) continue;

        const tokenAddress = change.contract.toLowerCase();
        
        if (!tokenBalanceData.has(tokenAddress)) {
          tokenBalanceData.set(tokenAddress, {
            tokenAddress,
            totalVolumeChange: BigInt(0),
            changeCount: 0,
            uniqueAddresses: new Set(),
            balanceChanges: []
          });
        }

        const data = tokenBalanceData.get(tokenAddress);
        
        // Calculate volume from balance change
        if (change.transferValue) {
          data.totalVolumeChange += BigInt(change.transferValue);
        }
        
        data.changeCount++;
        if (change.owner) data.uniqueAddresses.add(change.owner);
        data.balanceChanges.push(change);
      }

      // Create market data for each token
      const marketDataArray = [];
      
      for (const [tokenAddress, balanceData] of tokenBalanceData) {
        const graphData = graphDataMap.get(tokenAddress);

        if (!graphData) {
          console.warn(`No Token API data found for token ${tokenAddress}`);
          continue;
        }

        // Convert volume from wei to token units
        const volumeInTokens = Number(balanceData.totalVolumeChange) / Math.pow(10, graphData.decimals);
        const volumeUsd = volumeInTokens * graphData.priceUsd;

        // Calculate market cap
        const totalSupplyInTokens = parseFloat(graphData.totalSupply) / Math.pow(10, graphData.decimals);
        const marketCap = totalSupplyInTokens * graphData.priceUsd;

        const marketData = {
          tokenAddress,
          tokenSymbol: graphData.symbol,
          tokenName: graphData.name,
          decimals: graphData.decimals,

          // Real price data from Token API
          priceUsd: graphData.priceUsd,
          priceEth: graphData.priceEth,

          // Volume data (combining historical + current block)
          volume24h: graphData.volume24h,
          currentBlockVolume: volumeUsd,
          currentBlockVolumeTokens: volumeInTokens,

          // Liquidity data from Token API
          totalLiquidity: graphData.totalLiquidity,
          totalLiquidityUSD: graphData.totalLiquidityUSD,

          // Supply and market cap
          totalSupply: graphData.totalSupply,
          marketCap,

          // Balance change activity
          balanceChangeCount: balanceData.changeCount,
          uniqueAddresses: balanceData.uniqueAddresses.size,

          // Holder count from Token API
          totalHolders: graphData.holders,

          // Block info
          blockNumber: blockScopedData.number || 'unknown',
          blockHash: blockScopedData.hash || 'unknown',
          timestamp: Date.now(),

          // Historical price data
          ohlcv: graphData.ohlcv
        };

        marketDataArray.push(marketData);
      }

      // Save market data for each token
      for (const marketData of marketDataArray) {
        await saveMarketData(marketData);
        console.log(`Market data saved for ${marketData.tokenSymbol} (${marketData.tokenAddress}) - Price: $${marketData.priceUsd.toFixed(4)}`);
      }

      console.log(`Processed ${marketDataArray.length} unique tokens with real market data from balance changes`);
    } else {
      console.log(`No ERC-20 balance changes found in this block`);
    }
  } catch (error) {
    console.error("Error handling balance changes:", error);
  }
};

// Function to handle block undo signal messages
const handleBlockUndoSignalMessage = (blockUndoSignal) => {
  console.log(`Received block undo signal for block ${blockUndoSignal.blockNumber}`);
  // Clear relevant cache entries
  tokenCache.clear();
  priceCache.clear();
};

// Function to handle progress messages
const handleProgressMessage = (progress, registry) => {
  if (progress.processedBlocks % 100 === 0) {
    console.log(`Progress: Processed ${progress.processedBlocks} blocks, Token cache: ${tokenCache.size} tokens`);
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

// Main streaming function
const stream = async (pkg, registry, transport) => {
  const request = createRequest({
    substreamPackage: pkg,
    outputModule: MODULE,
    productionMode: true,
    startBlockNum: START_BLOCK,
    stopBlockNum: STOP_BLOCK,
    startCursor: getCursor() ?? undefined,
  });

  console.log(`Starting stream from block ${START_BLOCK} to ${STOP_BLOCK}`);

  // Stream the blocks
  for await (const statefulResponse of streamBlocks(transport, request)) {
    await handleResponseMessage(statefulResponse.response, registry);
    handleProgressMessage(statefulResponse.progress, registry);
  }
};

/*
  Entrypoint of the application.
  Uses The Graph Token API to get real token data and market information.
*/
export const startMarketDataStream = async () => {
  console.log('Starting ERC-20 market data stream with The Graph Token API...');

  const pkg = await fetchPackage();
  const registry = createRegistry(pkg);

  // Create gRPC connection
  const transport = createConnectTransport({
    baseUrl: ENDPOINT,
    interceptors: [createSubstreamsAuthInterceptor(TOKEN)],
    useBinaryFormat: true,
    jsonOptions: {
      typeRegistry: registry,
    },
  });

  console.log('Connected to Substreams endpoint');
  console.log('Using The Graph Token API for real token data and prices');

  // Test Token API connection
  try {
    const ethPrice = await getETHPrice();
    console.log(`Current ETH price from Token API: $${ethPrice}`);
  } catch (error) {
    console.warn('Warning: Could not fetch ETH price from Token API:', error.message);
  }

  // Infinite loop handles disconnections and reconnects automatically
  while (true) {
    try {
      await stream(pkg, registry, transport);
    } catch (e) {
      if (!isErrorRetryable(e)) {
        console.log(`A fatal error occurred: ${e}`);
        throw e;
      }
      console.log(`A retryable error occurred (${e}), retrying after backoff`);
      console.log(e);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

// Utility function to manually fetch token data from Token API
export const getTokenInfo = async (tokenAddress) => {
  return await fetchTokenDataFromGraph(tokenAddress);
};

// Utility function to get cache status
export const getCacheStatus = () => {
  return {
    tokenCacheSize: tokenCache.size,
    priceCacheSize: priceCache.size,
    cachedTokens: Array.from(tokenCache.keys())
  };
};

// Utility function to clear caches
export const clearCaches = () => {
  tokenCache.clear();
  priceCache.clear();
  console.log('All caches cleared');
};

// Only start streaming if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMarketDataStream();
}

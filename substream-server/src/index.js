import express from 'express';
import cors from 'cors';
import {
  initDatabase,
  getLatestMarketData,
  getHistoricalMarketData,
  getAllLatestMarketData,
  getMarketDataByBlockRange,
  savePumpfunEvent,
  getPumpfunEventsByToken,
  getPumpfunEventsByUser,
  getRecentPumpfunEvents,
  getPumpfunEventsByType,
  getPumpfunTokenStats,
  getPumpfunSwapsByDirection,
  getPumpfunTokenTradingStats,
  pool
} from './db/index.js';
import { startMarketDataStream } from './market/index.js';
import { startPumpfunEventStream } from './pumpfun/index.js';
import { startCronJob } from './db/cronjob.js';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// The Graph Token API configuration
const GRAPH_TOKEN_API = {
  endpoint: 'https://token-api.thegraph.com',
  token: process.env.GRAPH_API_TOKEN || "eyJhbGciOiJLTVNFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3OTQ4OTU2MTksImp0aSI6IjgwMjllZDg4LTY5ZWMtNDA2NC05OWFhLWFkNGY2ZDU0NWUwMiIsImlhdCI6MTc1ODg5NTYxOSwiaXNzIjoiZGZ1c2UuaW8iLCJzdWIiOiIwZGl6YTM4NWM5MmVhOTkzZGRhODIiLCJ2IjoyLCJha2kiOiIzMDVhZWZkNDE3YmJjNzgyNzAyY2FkN2IxMGViMzlkMTBlNTdiNWQ4MTU5M2ZkYTg2YWY4Yzk5YjljN2EwMDY0IiwidWlkIjoiMGRpemEzODVjOTJlYTk5M2RkYTgyIiwic3Vic3RyZWFtc19wbGFuX3RpZXIiOiJGUkVFIiwiY2ZnIjp7IlNVQlNUUkVBTVNfTUFYX1JFUVVFU1RTIjoiMiIsIlNVQlNUUkVBTVNfUEFSQUxMRUxfSk9CUyI6IjUiLCJTVUJTVFJFQU1TX1BBUkFMTEVMX1dPUktFUlMiOiI1In19.-BBfME1q4KdqXs4tmFstcwfJYDPxvT1Zl4RMfVlh29jDbzQHNIJA3OhT7NQsMDwNVEn0POHCHWHdpfCrOrgGHA"
};

const graphTokenApiRequest = async (path, params = {}) => {
  try {
    const response = await axios.get(`${GRAPH_TOKEN_API.endpoint}${path}`, {
      params: {
        network_id: 'mainnet',
        ...params
      },
      headers: {
        Authorization: `Bearer ${GRAPH_TOKEN_API.token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Token API error:', error);
    throw new Error(`Failed to execute request: ${error.message}`);
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Substream server is running',
    database: 'connected',
    marketData: 'streaming'
  });
});

// Admin endpoints
app.get('/admin/cache/status', async (req, res) => {
  try {
    // You would need to implement getCacheStatus() in your market/index.js
    res.json({
      success: true,
      message: 'Cache status endpoint (implementation needed)'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get cache status',
      message: error.message
    });
  }
});

app.post('/admin/cache/clear', async (req, res) => {
  try {
    // You would need to implement clearCaches() in your market/index.js
    res.json({
      success: true,
      message: 'Cache clear endpoint (implementation needed)'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to clear caches',
      message: error.message
    });
  }
});

// Helper function to get token info from Token API
async function getTokenInfoFromAPI(tokenAddress) {
  try {
    // Get token metadata
    const metadata = await graphTokenApiRequest(`/tokens/evm/${tokenAddress}`, {
      network_id: 'mainnet'
    });

    if (!metadata.data || metadata.data.length === 0) {
      return null;
    }

    const token = metadata.data[0];

    // Get OHLCV data for price
    const ohlcv = await graphTokenApiRequest(`/ohlc/prices/evm/${tokenAddress}`, {
      network_id: 'mainnet',
      interval: '1d',
      limit: 1
    });

    // Get holders for liquidity info
    const holders = await graphTokenApiRequest(`/holders/evm/${tokenAddress}`, {
      network_id: 'mainnet',
      limit: 10
    });

    const priceUsd = ohlcv.data && ohlcv.data.length > 0 ?
      parseFloat(ohlcv.data[0].close) : 0;

    const totalLiquidityUSD = holders.data ?
      holders.data.reduce((sum, holder) => sum + holder.value, 0) : 0;

    return {
      address: token.contract,
      symbol: token.symbol || 'UNKNOWN',
      name: token.name || 'Unknown Token',
      decimals: token.decimals || 18,
      totalSupply: token.circulating_supply || '0',
      priceUsd,
      priceEth: 0, // Would need ETH price to calculate
      volume24h: 0, // Would need historical data
      totalLiquidityUSD,
      holders: holders.data ? holders.data.length : 0,
      ohlcv: ohlcv.data || []
    };
  } catch (error) {
    console.error(`Error fetching token info for ${tokenAddress}:`, error);
    return null;
  }
}

// Get latest market data for a specific token
app.get('/api/market/token/:address', async (req, res) => {
  try {
    const { address } = req.params;

    // First try to get from database
    const marketData = await getLatestMarketData(address.toLowerCase());

    if (!marketData) {
      // If not in DB, try to fetch directly from Token API
      const tokenInfo = await getTokenInfoFromAPI(address.toLowerCase());

      if (!tokenInfo) {
        return res.status(404).json({
          error: 'Token not found in database or Token API'
        });
      }

      return res.json({
        success: true,
        data: {
          tokenAddress: address.toLowerCase(),
          tokenSymbol: tokenInfo.symbol,
          tokenName: tokenInfo.name,
          priceUsd: tokenInfo.priceUsd,
          priceEth: tokenInfo.priceEth,
          volume24h: tokenInfo.volume24h,
          marketCap: tokenInfo.totalSupply ? parseFloat(tokenInfo.totalSupply) * tokenInfo.priceUsd : null,
          totalLiquidity: tokenInfo.totalLiquidityUSD,
          holders: tokenInfo.holders,
          source: 'token-api'
        }
      });
    }

    res.json({
      success: true,
      data: {
        tokenAddress: marketData.token_address,
        tokenSymbol: marketData.token_symbol,
        tokenName: marketData.token_name,
        priceUsd: parseFloat(marketData.price_usd),
        priceEth: marketData.price_eth ? parseFloat(marketData.price_eth) : null,
        volume24h: marketData.volume_24h ? parseFloat(marketData.volume_24h) : null,
        marketCap: marketData.market_cap ? parseFloat(marketData.market_cap) : null,
        percentChange1h: marketData.percent_change_1h ? parseFloat(marketData.percent_change_1h) : null,
        percentChange24h: marketData.percent_change_24h ? parseFloat(marketData.percent_change_24h) : null,
        percentChange7d: marketData.percent_change_7d ? parseFloat(marketData.percent_change_7d) : null,
        blockNumber: marketData.block_number,
        blockHash: marketData.block_hash,
        timestamp: marketData.timestamp,
        source: 'database'
      }
    });
  } catch (error) {
    console.error('Error fetching market data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get all latest market data
app.get('/api/market/all', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    // Get all latest market data from database
    const allMarketData = await getAllLatestMarketData(limit, offset);

    const formattedData = allMarketData.map(marketData => ({
      tokenAddress: marketData.token_address,
      tokenSymbol: marketData.token_symbol,
      tokenName: marketData.token_name,
      priceUsd: parseFloat(marketData.price_usd),
      priceEth: marketData.price_eth ? parseFloat(marketData.price_eth) : null,
      volume24h: marketData.volume_24h ? parseFloat(marketData.volume_24h) : null,
      marketCap: marketData.market_cap ? parseFloat(marketData.market_cap) : null,
      percentChange1h: marketData.percent_change_1h ? parseFloat(marketData.percent_change_1h) : null,
      percentChange24h: marketData.percent_change_24h ? parseFloat(marketData.percent_change_24h) : null,
      percentChange7d: marketData.percent_change_7d ? parseFloat(marketData.percent_change_7d) : null,
      blockNumber: marketData.block_number,
      blockHash: marketData.block_hash,
      timestamp: marketData.timestamp
    }));

    res.json({
      success: true,
      count: formattedData.length,
      data: formattedData
    });
  } catch (error) {
    console.error('Error fetching all market data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Add this new endpoint to search for tokens
app.get('/api/market/search/:query', async (req, res) => {
  try {
    const { query } = req.params;

    // In a real implementation, you would search a token list or database
    // For this example, we'll just return some mock data
    const mockResults = [
      {
        address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", // UNI
        symbol: "UNI",
        name: "Uniswap"
      },
      {
        address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
        symbol: "WETH",
        name: "Wrapped Ether"
      }
    ];

    // Filter mock results based on query
    const filtered = mockResults.filter(token =>
      token.symbol.toLowerCase().includes(query.toLowerCase()) ||
      token.name.toLowerCase().includes(query.toLowerCase()) ||
      token.address.toLowerCase().includes(query.toLowerCase())
    );

    // Get additional info for each token
    const results = await Promise.all(
      filtered.map(async token => {
        const info = await getTokenInfoFromAPI(token.address);
        return {
          ...token,
          priceUsd: info?.priceUsd || 0,
          priceEth: info?.priceEth || 0
        };
      })
    );

    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error searching tokens:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Pumpfun Events API Endpoints

// Get Pumpfun events for a specific token
app.get('/api/pumpfun/token/:address/events', async (req, res) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const events = await getPumpfunEventsByToken(address, limit);
    const stats = await getPumpfunTokenStats(address);

    res.json({
      success: true,
      data: {
        events,
        stats,
        count: events.length
      }
    });
  } catch (error) {
    console.error('Error fetching Pumpfun token events:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get Pumpfun events for a specific user
app.get('/api/pumpfun/user/:address/events', async (req, res) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const events = await getPumpfunEventsByUser(address, limit);

    res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error('Error fetching Pumpfun user events:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get recent Pumpfun events
app.get('/api/pumpfun/events/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const eventType = req.query.type;
    const direction = req.query.direction; // buy or sell

    let events;
    if (direction) {
      events = await getPumpfunSwapsByDirection(direction, limit);
    } else if (eventType) {
      events = await getPumpfunEventsByType(eventType, limit);
    } else {
      events = await getRecentPumpfunEvents(limit);
    }

    res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error('Error fetching recent Pumpfun events:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get Pumpfun swaps by direction (buy/sell)
app.get('/api/pumpfun/swaps/:direction', async (req, res) => {
  try {
    const { direction } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    if (!['buy', 'sell'].includes(direction)) {
      return res.status(400).json({
        error: 'Invalid direction',
        message: 'Direction must be either "buy" or "sell"'
      });
    }

    const events = await getPumpfunSwapsByDirection(direction, limit);

    res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error('Error fetching Pumpfun swaps by direction:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get Pumpfun token statistics
app.get('/api/pumpfun/token/:address/stats', async (req, res) => {
  try {
    const { address } = req.params;
    const basicStats = await getPumpfunTokenStats(address);
    const tradingStats = await getPumpfunTokenTradingStats(address);

    res.json({
      success: true,
      data: {
        basic: basicStats,
        trading: tradingStats
      }
    });
  } catch (error) {
    console.error('Error fetching Pumpfun token stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// RPC endpoint for getting token price (compatible with wallet integrations)
app.post('/api/rpc', async (req, res) => {
  try {
    const { method, params, id = null } = req.body;

    switch (method) {
      case 'getTokenPrice':
        const { tokenAddress } = params;

        // First try database
        const marketData = await getLatestMarketData(tokenAddress.toLowerCase());

        if (marketData) {
          return res.json({
            jsonrpc: '2.0',
            result: {
              tokenAddress: marketData.token_address,
              symbol: marketData.token_symbol,
              name: marketData.token_name,
              priceUsd: parseFloat(marketData.price_usd),
              priceEth: marketData.price_eth ? parseFloat(marketData.price_eth) : null,
              timestamp: marketData.timestamp,
              source: 'database'
            },
            id
          });
        }

        // If not in DB, try Token API
        const tokenInfo = await getTokenInfoFromAPI(tokenAddress.toLowerCase());

        if (!tokenInfo) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Token not found' },
            id
          });
        }

        return res.json({
          jsonrpc: '2.0',
          result: {
            tokenAddress: tokenAddress.toLowerCase(),
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            priceUsd: tokenInfo.priceUsd,
            priceEth: tokenInfo.priceEth,
            timestamp: new Date().toISOString(),
            source: 'token-api'
          },
          id
        });

      case 'getTokenInfo':
        const { address } = params;
        const info = await getTokenInfoFromAPI(address.toLowerCase());

        if (!info) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Token not found' },
            id
          });
        }

        return res.json({
          jsonrpc: '2.0',
          result: {
            address: info.address,
            symbol: info.symbol,
            name: info.name,
            decimals: info.decimals,
            priceUsd: info.priceUsd,
            priceEth: info.priceEth,
            totalSupply: info.totalSupply,
            marketCap: parseFloat(info.totalSupply) * info.priceUsd,
            totalLiquidity: info.totalLiquidityUSD,
            holders: info.holders,
            ohlcv: info.ohlcv
          },
          id
        });

      case 'getPumpfunEvents':
        const { tokenAddress: pumpTokenAddress, limit: pumpLimit = 100 } = params;
        
        if (!pumpTokenAddress) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Missing tokenAddress parameter' },
            id
          });
        }

        const pumpEvents = await getPumpfunEventsByToken(pumpTokenAddress, pumpLimit);
        const pumpStats = await getPumpfunTokenStats(pumpTokenAddress);

        return res.json({
          jsonrpc: '2.0',
          result: {
            events: pumpEvents,
            stats: pumpStats,
            count: pumpEvents.length
          },
          id
        });

      case 'getPumpfunUserEvents':
        const { userAddress, limit: userLimit = 100 } = params;
        
        if (!userAddress) {
          return res.json({
            jsonrpc: '2.0',
            error: { code: -32602, message: 'Missing userAddress parameter' },
            id
          });
        }

        const userEvents = await getPumpfunEventsByUser(userAddress, userLimit);

        return res.json({
          jsonrpc: '2.0',
          result: {
            events: userEvents,
            count: userEvents.length
          },
          id
        });

      default:
        return res.json({
          jsonrpc: '2.0',
          error: { code: -32601, message: 'Method not found' },
          id
        });
    }
  } catch (error) {
    console.error('RPC Error:', error);
    res.json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
        details: error.message
      },
      id: req.body.id || null
    });
  }
});

// Start server
const startServer = async () => {
  try {
    // Initialize database
    await initDatabase();
    console.log('Database initialized');

    // Start the market data streaming in background
    startMarketDataStream();
    console.log('Market data stream started');

    // Start the Pumpfun events streaming in background
    startPumpfunEventStream();
    console.log('Pumpfun events stream started');

    // Start the data cleanup cronjob
    startCronJob();
    console.log('Data cleanup cronjob started');

    app.listen(PORT, () => {
      console.log(`Substream server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API endpoints:`);
      console.log(`- GET /api/market/token/:address - Get latest market data for token`);
      console.log(`- GET /api/market/search/:query - Search for tokens`);
      console.log(`- GET /api/market/all - Get all latest market data`);
      console.log(`- GET /api/pumpfun/token/:address/events - Get Pumpfun events for token`);
      console.log(`- GET /api/pumpfun/user/:address/events - Get Pumpfun events for user`);
      console.log(`- GET /api/pumpfun/events/recent?direction=buy|sell - Get recent Pumpfun events`);
      console.log(`- GET /api/pumpfun/swaps/:direction - Get swaps by direction (buy/sell)`);
      console.log(`- GET /api/pumpfun/token/:address/stats - Get Pumpfun token statistics`);
      console.log(`- POST /api/rpc - RPC endpoint for integrations`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

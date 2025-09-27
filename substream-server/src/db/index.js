import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Allow self-signed certificates for development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20
});

// Initialize database tables
export const initDatabase = async () => {
  const client = await pool.connect();
  try {
    // Create market_data table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_data (
        id SERIAL PRIMARY KEY,
        token_address VARCHAR(42) NOT NULL,
        token_symbol VARCHAR(20) NOT NULL,
        token_name VARCHAR(100) NOT NULL,
        price_usd DECIMAL(20, 8) NOT NULL,
        price_eth DECIMAL(20, 8),
        volume_24h DECIMAL(20, 2),
        market_cap DECIMAL(20, 2),
        percent_change_1h DECIMAL(8, 4),
        percent_change_24h DECIMAL(8, 4),
        percent_change_7d DECIMAL(8, 4),
        block_number BIGINT NOT NULL,
        block_hash VARCHAR(66) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(token_address, block_number)
      )
    `);

    // Create pumpfun_events table for Pumpfun events
    await client.query(`
      CREATE TABLE IF NOT EXISTS pumpfun_events (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        block_number BIGINT NOT NULL,
        block_hash VARCHAR(100) NOT NULL,
        transaction_hash VARCHAR(100) NOT NULL,
        log_index INTEGER NOT NULL,
        token_address VARCHAR(50) NOT NULL,
        user_address VARCHAR(50) NOT NULL,
        amount DECIMAL(30, 0) NOT NULL,
        sol_amount DECIMAL(30, 0) NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(transaction_hash, log_index)
      )
    `);

    // Add indexes for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pumpfun_events_event_type_direction 
      ON pumpfun_events USING gin ((metadata->'direction'))
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pumpfun_events_metadata_bonding_curve 
      ON pumpfun_events USING gin ((metadata->'bondingCurve'))
    `);

    // Create indexes for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_market_data_token_address ON market_data(token_address);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_market_data_timestamp ON market_data(timestamp);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_market_data_block_number ON market_data(block_number);
    `);

    // Pumpfun events indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pumpfun_events_token_address ON pumpfun_events(token_address);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pumpfun_events_user_address ON pumpfun_events(user_address);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pumpfun_events_event_type ON pumpfun_events(event_type);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pumpfun_events_timestamp ON pumpfun_events(timestamp);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pumpfun_events_block_number ON pumpfun_events(block_number);
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Save market data to database
export const saveMarketData = async (marketData) => {
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO market_data (
        token_address, token_symbol, token_name, price_usd, price_eth,
        volume_24h, market_cap, percent_change_1h, percent_change_24h,
        percent_change_7d, block_number, block_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (token_address, block_number) 
      DO UPDATE SET
        price_usd = EXCLUDED.price_usd,
        price_eth = EXCLUDED.price_eth,
        volume_24h = EXCLUDED.volume_24h,
        market_cap = EXCLUDED.market_cap,
        percent_change_1h = EXCLUDED.percent_change_1h,
        percent_change_24h = EXCLUDED.percent_change_24h,
        percent_change_7d = EXCLUDED.percent_change_7d,
        timestamp = CURRENT_TIMESTAMP
    `;

    const values = [
      marketData.tokenAddress,
      marketData.tokenSymbol,
      marketData.tokenName,
      marketData.priceUsd,
      marketData.priceEth,
      marketData.volume24h,
      marketData.marketCap,
      marketData.percentChange1h,
      marketData.percentChange24h,
      marketData.percentChange7d,
      marketData.blockNumber,
      marketData.blockHash
    ];

    await client.query(query, values);
    console.log(`Market data saved for token: ${marketData.tokenSymbol}`);
  } catch (error) {
    console.error('Error saving market data:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get latest market data for a token
export const getLatestMarketData = async (tokenAddress) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT * FROM market_data 
      WHERE token_address = $1 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
    
    const result = await client.query(query, [tokenAddress]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting latest market data:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get historical market data for a token
export const getHistoricalMarketData = async (tokenAddress, limit = 100) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT * FROM market_data 
      WHERE token_address = $1 
      ORDER BY timestamp DESC 
      LIMIT $2
    `;
    
    const result = await client.query(query, [tokenAddress, limit]);
    return result.rows;
  } catch (error) {
    console.error('Error getting historical market data:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get all tokens with their latest market data
export const getAllLatestMarketData = async () => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT DISTINCT ON (token_address) * 
      FROM market_data 
      ORDER BY token_address, timestamp DESC
    `;
    
    const result = await client.query(query);
    return result.rows;
  } catch (error) {
    console.error('Error getting all latest market data:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get market data by block range
export const getMarketDataByBlockRange = async (startBlock, endBlock) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT * FROM market_data 
      WHERE block_number BETWEEN $1 AND $2 
      ORDER BY block_number ASC
    `;
    
    const result = await client.query(query, [startBlock, endBlock]);
    return result.rows;
  } catch (error) {
    console.error('Error getting market data by block range:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Save Pumpfun event to database
export const savePumpfunEvent = async (eventData) => {
  const client = await pool.connect();
  try {
    const query = `
      INSERT INTO pumpfun_events (
        event_type, block_number, block_hash, transaction_hash, log_index,
        token_address, user_address, amount, sol_amount, timestamp, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (transaction_hash, log_index) 
      DO UPDATE SET
        event_type = EXCLUDED.event_type,
        amount = EXCLUDED.amount,
        sol_amount = EXCLUDED.sol_amount,
        timestamp = EXCLUDED.timestamp,
        metadata = EXCLUDED.metadata
    `;

    const values = [
      eventData.eventType,
      eventData.blockNumber,
      eventData.blockHash,
      eventData.transactionHash,
      eventData.logIndex,
      eventData.tokenAddress,
      eventData.user,
      eventData.amount,
      eventData.solAmount,
      eventData.timestamp,
      eventData.metadata
    ];

    await client.query(query, values);
    console.log(`Pumpfun event saved - Type: ${eventData.eventType}, Token: ${eventData.tokenAddress}`);
  } catch (error) {
    console.error('Error saving Pumpfun event:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get Pumpfun events for a specific token
export const getPumpfunEventsByToken = async (tokenAddress, limit = 100) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT * FROM pumpfun_events 
      WHERE token_address = $1 
      ORDER BY timestamp DESC 
      LIMIT $2
    `;
    
    const result = await client.query(query, [tokenAddress, limit]);
    return result.rows;
  } catch (error) {
    console.error('Error getting Pumpfun events by token:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get Pumpfun events for a specific user
export const getPumpfunEventsByUser = async (userAddress, limit = 100) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT * FROM pumpfun_events 
      WHERE user_address = $1 
      ORDER BY timestamp DESC 
      LIMIT $2
    `;
    
    const result = await client.query(query, [userAddress, limit]);
    return result.rows;
  } catch (error) {
    console.error('Error getting Pumpfun events by user:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get recent Pumpfun events
export const getRecentPumpfunEvents = async (limit = 100) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT * FROM pumpfun_events 
      ORDER BY timestamp DESC 
      LIMIT $1
    `;
    
    const result = await client.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error('Error getting recent Pumpfun events:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get Pumpfun events by type
export const getPumpfunEventsByType = async (eventType, limit = 100) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT * FROM pumpfun_events 
      WHERE event_type = $1 
      ORDER BY timestamp DESC 
      LIMIT $2
    `;
    
    const result = await client.query(query, [eventType, limit]);
    return result.rows;
  } catch (error) {
    console.error('Error getting Pumpfun events by type:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get Pumpfun swap events by direction (buy/sell)
export const getPumpfunSwapsByDirection = async (direction, limit = 100) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT * FROM pumpfun_events 
      WHERE event_type LIKE 'swap_%' 
      AND metadata->>'direction' = $1 
      ORDER BY timestamp DESC 
      LIMIT $2
    `;
    
    const result = await client.query(query, [direction, limit]);
    return result.rows;
  } catch (error) {
    console.error('Error getting Pumpfun swaps by direction:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get Pumpfun token trading volume and statistics
export const getPumpfunTokenTradingStats = async (tokenAddress) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE event_type = 'swap_buy') as buy_count,
        COUNT(*) FILTER (WHERE event_type = 'swap_sell') as sell_count,
        SUM(CAST(amount AS DECIMAL)) FILTER (WHERE event_type = 'swap_buy') as total_buy_amount,
        SUM(CAST(amount AS DECIMAL)) FILTER (WHERE event_type = 'swap_sell') as total_sell_amount,
        SUM(CAST(sol_amount AS DECIMAL)) FILTER (WHERE event_type = 'swap_buy') as total_buy_sol,
        SUM(CAST(sol_amount AS DECIMAL)) FILTER (WHERE event_type = 'swap_sell') as total_sell_sol,
        COUNT(DISTINCT user_address) as unique_traders,
        MAX(timestamp) as last_trade_time,
        MIN(timestamp) as first_trade_time,
        AVG(CAST(sol_amount AS DECIMAL)) FILTER (WHERE event_type LIKE 'swap_%') as avg_trade_size_sol
      FROM pumpfun_events 
      WHERE token_address = $1 
      AND event_type LIKE 'swap_%'
    `;
    
    const result = await client.query(query, [tokenAddress]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting Pumpfun token trading stats:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get Pumpfun trading statistics for a token
export const getPumpfunTokenStats = async (tokenAddress) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT 
        COUNT(*) as total_trades,
        COUNT(DISTINCT user_address) as unique_traders,
        SUM(CASE WHEN event_type = 'buy' THEN CAST(amount AS DECIMAL) ELSE 0 END) as total_buy_amount,
        SUM(CASE WHEN event_type = 'sell' THEN CAST(amount AS DECIMAL) ELSE 0 END) as total_sell_amount,
        SUM(CAST(sol_amount AS DECIMAL)) as total_sol_volume,
        MAX(timestamp) as last_trade_time,
        MIN(timestamp) as first_trade_time
      FROM pumpfun_events 
      WHERE token_address = $1
    `;
    
    const result = await client.query(query, [tokenAddress]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting Pumpfun token stats:', error);
    throw error;
  } finally {
    client.release();
  }
};

export { pool };

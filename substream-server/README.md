# Substream Market Data API

This server continuously collects blockchain market data using Substreams and provides REST and RPC endpoints to access the data.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env`:
```
DB_URL=postgres://avnadmin:AVNS_DgcnHLTedUAqpmKKeWE@pg-1dc4da14-krish-cfed.j.aivencloud.com:11513/defaultdb?sslmode=require
PORT=3000
```

3. Start the server:
```bash
npm start
```

## API Endpoints

### REST Endpoints

#### Health Check
```
GET /health
```
Returns server status.

#### Get Latest Market Data for Token
```
GET /api/market/token/:address
```
Returns the latest market data for a specific token address.

**Example:**
```bash
curl http://localhost:3000/api/market/token/0xa0b86a33e6e2e02b79e8c0b9e4b8d4c0c0b8e2e2
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tokenAddress": "0xa0b86a33e6e2e02b79e8c0b9e4b8d4c0c0b8e2e2",
    "tokenSymbol": "ETH",
    "tokenName": "Ethereum",
    "priceUsd": 2500.50,
    "priceEth": 1.0,
    "volume24h": 750000.00,
    "marketCap": 75000000.00,
    "percentChange1h": 2.5,
    "percentChange24h": -1.2,
    "percentChange7d": 8.7,
    "blockNumber": 18500000,
    "blockHash": "0x...",
    "timestamp": "2025-09-27T10:00:00Z"
  }
}
```

#### Get Historical Market Data
```
GET /api/market/token/:address/history?limit=100
```
Returns historical market data for a token (default limit: 100).

#### Get All Latest Market Data
```
GET /api/market/all
```
Returns latest market data for all tracked tokens.

#### Get Market Data by Block Range
```
GET /api/market/blocks/:start/:end
```
Returns market data within a specific block range (max 10,000 blocks).

**Example:**
```bash
curl http://localhost:3000/api/market/blocks/18500000/18500100
```

### RPC Endpoint

#### JSON-RPC Interface
```
POST /api/rpc
Content-Type: application/json
```

**Available Methods:**

1. **getTokenPrice** - Get current token price
```json
{
  "jsonrpc": "2.0",
  "method": "getTokenPrice",
  "params": {
    "tokenAddress": "0xa0b86a33e6e2e02b79e8c0b9e4b8d4c0c0b8e2e2"
  },
  "id": 1
}
```

2. **getAllTokens** - Get all token prices
```json
{
  "jsonrpc": "2.0",
  "method": "getAllTokens",
  "params": {},
  "id": 1
}
```

**Example RPC Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "tokenAddress": "0xa0b86a33e6e2e02b79e8c0b9e4b8d4c0c0b8e2e2",
    "symbol": "ETH",
    "name": "Ethereum",
    "priceUsd": 2500.50,
    "priceEth": 1.0,
    "timestamp": "2025-09-27T10:00:00Z"
  },
  "id": 1
}
```

## Integration with Wallet Services

The RPC endpoint (`/api/rpc`) is designed to be compatible with wallet integrations. You can use it to:

1. Get real-time token prices for portfolio calculations
2. Fetch historical data for charts and analytics  
3. Monitor market changes for trading decisions

## Database Schema

The server automatically creates the following table:

```sql
CREATE TABLE market_data (
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
);
```

## Commands

- `npm start` - Start the production server
- `npm run dev` - Start the development server with file watching
- `npm run stream` - Run only the substream data collector
- `npm test` - Run tests (placeholder)

## Notes

1. The server automatically starts both the API endpoints and the background substream data collection
2. Data is continuously updated as new blocks are processed
3. The database connection is configured via the `DB_URL` environment variable
4. All token addresses are normalized to lowercase for consistency
5. The mock data in the current implementation should be replaced with actual substream parsing logic

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `404` - Token/data not found
- `400` - Bad request (invalid parameters)
- `500` - Internal server error

RPC endpoints follow JSON-RPC 2.0 error format:
- `-32000` - Token not found
- `-32601` - Method not found  
- `-32603` - Internal error
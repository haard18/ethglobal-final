# Pumpfun Events Substreams Integration

This integration adds real-time monitoring of Pumpfun events on the Solana blockchain using Substreams technology.

## Overview

The Pumpfun integration streams live events from the Pumpfun protocol and stores them in a PostgreSQL database. It provides comprehensive API endpoints for accessing trading data, user activities, and token statistics.

## Features

- **Real-time Event Streaming**: Monitors Pumpfun events as they happen on Solana
- **Database Storage**: Stores all events in PostgreSQL with proper indexing
- **RESTful API**: Comprehensive endpoints for querying events and statistics
- **RPC Interface**: JSON-RPC compatible methods for wallet integrations
- **Event Types**: Handles various Pumpfun event types (buy, sell, create, etc.)

## Database Schema

### pumpfun_events Table

```sql
CREATE TABLE pumpfun_events (
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
);
```

## API Endpoints

### REST API

#### Get Token Events
```http
GET /api/pumpfun/token/:address/events?limit=100
```
Returns all events for a specific token with trading statistics.

#### Get User Events
```http
GET /api/pumpfun/user/:address/events?limit=100
```
Returns all events for a specific user address.

#### Get Recent Events
```http
GET /api/pumpfun/events/recent?limit=100&type=buy
```
Returns recent Pumpfun events, optionally filtered by event type.

#### Get Token Statistics
```http
GET /api/pumpfun/token/:address/stats
```
Returns comprehensive trading statistics for a token:
- Total trades count
- Unique traders count
- Total buy/sell amounts
- Total SOL volume
- First and last trade times

### JSON-RPC API

The server also provides RPC methods accessible via `POST /api/rpc`:

#### Get Pumpfun Events
```json
{
  "jsonrpc": "2.0",
  "method": "getPumpfunEvents",
  "params": {
    "tokenAddress": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "limit": 100
  },
  "id": 1
}
```

#### Get User Events
```json
{
  "jsonrpc": "2.0",
  "method": "getPumpfunUserEvents",
  "params": {
    "userAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "limit": 100
  },
  "id": 1
}
```

## Configuration

### Environment Variables

Make sure these are set in your `.env` file:

```bash
# Database connection
DB_URL=postgres://user:password@host:port/database

# Substreams API token (required for Solana endpoint)
SUBSTREAMS_API_TOKEN=your_substreams_token_here
```

### Substreams Configuration

The integration uses:
- **Package**: `https://spkg.io/0xpapercut/pumpfun-events-v0.1.7.spkg`
- **Module**: `pumpfun_events`
- **Endpoint**: `https://mainnet.sol.streamingfast.io`
- **Start Block**: `300000000` (configurable)

## Running the Service

### Full Server (includes both market data and Pumpfun events)
```bash
npm run start
```

### Pumpfun Events Only
```bash
npm run pumpfun
```

### Development Mode
```bash
npm run dev
```

### Test Integration
```bash
node test-pumpfun.js
```

## Example Usage

### Get Recent Pumpfun Events
```bash
curl http://localhost:3000/api/pumpfun/events/recent?limit=10
```

### Get Events for a Specific Token
```bash
curl http://localhost:3000/api/pumpfun/token/9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM/events
```

### Get Trading Statistics
```bash
curl http://localhost:3000/api/pumpfun/token/9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM/stats
```

## Event Types

The integration handles various Pumpfun event types:
- `buy` - Token purchase events
- `sell` - Token sale events  
- `create` - New token creation events
- `transfer` - Token transfer events

## Data Flow

1. **Stream Connection**: Connects to Solana Substreams endpoint
2. **Event Processing**: Processes incoming Pumpfun events from blocks
3. **Data Extraction**: Extracts relevant event data (token, user, amounts)
4. **Database Storage**: Saves events to PostgreSQL with proper indexing
5. **API Access**: Provides real-time access via REST and RPC APIs

## Monitoring

The service provides health checks and logging:
- Health endpoint: `GET /health`
- Real-time event processing logs
- Database connection monitoring
- Error handling and reconnection logic

## Integration with Wallets

The RPC interface allows easy integration with wallet applications:

```javascript
const response = await fetch('http://localhost:3000/api/rpc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'getPumpfunEvents',
    params: { tokenAddress: 'your_token_address' },
    id: 1
  })
});

const { result } = await response.json();
console.log('Pumpfun events:', result.events);
console.log('Trading stats:', result.stats);
```

## Performance Considerations

- Events are indexed by token address, user address, and timestamp
- Unique constraints prevent duplicate events
- JSONB metadata field allows flexible event data storage
- Connection pooling handles multiple concurrent requests
- Automatic reconnection handles network interruptions

## Troubleshooting

### Common Issues

1. **Connection Errors**: Ensure SUBSTREAMS_API_TOKEN is valid
2. **Database Errors**: Check DB_URL connection string
3. **Missing Events**: Verify start block number is recent enough
4. **High Memory Usage**: Adjust connection pool settings if needed

### Debug Mode

Enable detailed logging by running with:
```bash
DEBUG=* npm run start
```
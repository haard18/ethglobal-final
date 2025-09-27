# Market Data Integration for Pluto RPI Server

This integration adds comprehensive market data capabilities to the Pluto voice assistant, allowing users to query real-time market information, token statistics, and trading activity through voice commands.

## Features

### Voice Commands Supported

- **Market Overview**: "market overview", "market status", "how is the market"
- **Token Prices**: "price of [token]", "what is the price of [token]"
- **Token Statistics**: "token stats for [token]", "token info [token]"
- **Recent Activity**: "recent market activity", "latest trades"
- **Top Performers**: "top gainers", "top losers", "best performing tokens"
- **Trending Tokens**: "trending tokens", "hot tokens", "what's trending"
- **Price Comparisons**: "price change for [token]", "price over last 24 hours"
- **User Activity**: "user activity for [address]", "trading activity for [address]"

### API Endpoints

#### REST Endpoints

- `GET /market/overview` - Get market overview
- `GET /market/token/:address/price` - Get token price
- `GET /market/token/:address/stats` - Get token statistics
- `GET /market/activity/recent?limit=10&type=buy` - Get recent market activity
- `GET /market/top/gainers?limit=10` - Get top gaining tokens
- `GET /market/top/losers?limit=10` - Get top losing tokens
- `GET /market/user/:address/activity?limit=50` - Get user trading activity
- `GET /market/health` - Check market data service health

#### Substream Server Integration

All market data is sourced from: `https://substream-server.onrender.com`

**Supported endpoints:**
- `/api/pumpfun/token/:address/events` - Token events
- `/api/pumpfun/user/:address/events` - User events  
- `/api/pumpfun/events/recent` - Recent events
- `/api/pumpfun/token/:address/stats` - Token statistics
- `/api/rpc` - JSON-RPC interface

## Architecture

### Core Components

1. **MarketDataService** (`src/services/marketDataService.ts`)
   - Handles communication with substream server
   - Provides caching and error handling
   - Formats data for voice responses

2. **MarketCommandRouter** (`src/services/marketCommandRouter.ts`)
   - Routes market-related voice commands
   - Maintains conversation context
   - Integrates with conversation manager

3. **Voice Integration** (`src/services/voiceCommandRouter.ts`)
   - Automatically detects market-related commands
   - Routes to appropriate handlers
   - Maintains conversation flow

### Data Flow

```
Voice Input → Command Detection → Market Router → Substream API → Response Formatting → Voice Output
```

## Usage Examples

### Voice Commands

```
User: "Hey Pluto, what's the market overview?"
Pluto: "Current market overview: 1,250 tokens tracked, 15,432 active traders, 45.67 SOL total volume. Top gainer: TOKEN up 15.32%. 25 recent transactions in the last period."

User: "Show me recent market activity"
Pluto: "Recent market activity shows 10 events: 6 buy orders, 3 sell orders, 1 new tokens created"

User: "What are the top gainers today?"
Pluto: "Top gaining tokens: 1. TOKEN1: 15.32%, 2. TOKEN2: 12.45%, 3. TOKEN3: 9.87%"
```

### API Usage

```bash
# Get market overview
curl http://localhost:3000/market/overview

# Get token price
curl http://localhost:3000/market/token/0x1234.../price

# Get recent activity
curl http://localhost:3000/market/activity/recent?limit=10

# Get top gainers
curl http://localhost:3000/market/top/gainers?limit=5
```

### RPI Server Voice Processing

The market integration automatically handles:
- Context maintenance across conversations
- Token address extraction and validation
- Error handling and fallbacks
- Response formatting for voice output

## Configuration

### Environment Variables

No additional environment variables required. The integration uses:
- Base URL: `https://substream-server.onrender.com`
- Timeout: 10 seconds
- Retries: 3 attempts

### Conversation Context

Market queries maintain context including:
- Last queried token address
- Last queried user address  
- Current topic (price, stats, activity, etc.)
- Conversation history for better responses

## Testing

Run the integration test suite:

```bash
cd rpi-server
npm run test -- test/market-integration-test.ts
```

The test suite covers:
- Market command detection
- Service connectivity
- Voice command processing
- Error handling

## Error Handling

The integration includes comprehensive error handling:
- Service unavailability gracefully handled
- Invalid addresses properly validated
- Timeout and retry logic for reliability
- User-friendly error messages

## Future Enhancements

- Historical price charts and analysis
- Portfolio tracking integration
- Price alerts and notifications  
- Advanced trading analytics
- Cross-chain market data
- Real-time price streaming

## Dependencies

- `axios` - HTTP client for API requests
- Conversation manager integration
- Voice command routing system
- UI sync service for display updates
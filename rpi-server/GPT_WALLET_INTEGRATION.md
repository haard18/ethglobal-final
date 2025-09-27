# 🤖 GPT Wallet Integration Guide

This document explains how the Pluto AI assistant now intelligently handles wallet-related queries using GPT integration with The Graph Protocol market data.

## 🎯 New GPT Actions

The system now recognizes and handles these wallet-related queries:

### 💰 Balance & Value Queries
- `GET_WALLET_BALANCE` - Get wallet ETH balance and total portfolio value
- `GET_PORTFOLIO_VALUE` - Complete portfolio breakdown with risk analysis
- `GET_TOKEN_PRICE` - Specific token price and holdings information

### 📊 Portfolio Analytics
- `GET_TOKEN_HOLDINGS` - All token holdings with filtering options
- `GET_WALLET_SUMMARY` - Comprehensive wallet overview with activity level
- Market insights and diversification analysis

## 🗣️ Natural Language Examples

### Balance Queries
- "What's my wallet balance?"
- "How much ETH do I have?"
- "Show me my portfolio value"
- "What's my total crypto worth?"

### Token-Specific Queries
- "What's the price of USDC in my wallet?"
- "How much is my BTC worth?"
- "Tell me about my WETH holdings"
- "Do I have any stable coins?"

### Portfolio Analysis
- "Show me my complete portfolio"
- "What are my top token holdings?"
- "Give me a portfolio breakdown"
- "What's my largest holding?"

### Summary & Insights
- "Give me a wallet summary"
- "What's in my wallet?"
- "Show me my crypto overview"
- "How diversified is my portfolio?"

## 🔧 API Endpoints

### Quick Query Endpoints
```
GET /query/balance          - Quick wallet balance
GET /query/portfolio        - Portfolio value breakdown
GET /query/summary          - Comprehensive wallet summary
GET /query/holdings         - Token holdings (with filters)
GET /query/insights         - Market insights & risk analysis
```

### Token-Specific Endpoints
```
GET /query/token/:symbol/price  - Specific token price
GET /query/search/:term         - Search tokens by name/symbol
```

### Filter Parameters
```
?minValue=100     - Only tokens worth over $100
?symbol=USD       - Filter by symbol (e.g., stablecoins)
```

## 🧠 GPT Intent Analysis

The system uses advanced intent analysis to:

1. **Identify Action Types**: Determines if user wants wallet data vs general conversation
2. **Extract Parameters**: Pulls token symbols, amounts, and filters from natural language
3. **Generate Responses**: Creates both text and spoken responses
4. **Handle Errors**: Provides helpful guidance when wallets/tokens aren't found

### Parameter Extraction Examples

| User Query | Extracted Parameters |
|------------|---------------------|
| "USDC price" | `{ tokenSymbol: "USDC" }` |
| "tokens worth over $100" | `{ minValue: 100 }` |
| "stable coins" | `{ symbol: "USD" }` |
| "how much BTC" | `{ tokenSymbol: "BTC" }` |

## 🎵 Voice Integration

All wallet queries include:
- **Spoken Responses**: Optimized for audio output
- **Screen Display**: Detailed data for visual review
- **Error Handling**: Clear voice feedback for issues

### Example Voice Responses
- "Your portfolio is worth 1,500 dollars with low risk diversification"
- "Your USDC is worth 250 dollars, which is 15 percent of your portfolio"
- "You hold 8 tokens with value, totaling 2,300 dollars"

## 🚀 Advanced Features

### Risk Analysis
- **Portfolio Concentration**: Measures diversification risk
- **Risk Levels**: Low, Medium, High, Very High
- **Diversification Score**: Based on number of holdings

### Market Insights
- **Top Performers**: Identifies largest holdings
- **Small Holdings**: Counts positions under $10
- **Activity Level**: Tracks transaction frequency

### Smart Filtering
- **Value Thresholds**: Filter by minimum USD value
- **Symbol Search**: Find tokens by partial name/symbol match
- **Portfolio Ranking**: Automatic sorting by value

## 🛠️ Integration Architecture

```
User Query → GPT Intent Analysis → Wallet Query Service → Graph Protocol API → Formatted Response + Voice Output
```

### Services Involved
1. **GPTService**: Intent analysis and parameter extraction
2. **WalletQueryService**: Unified wallet data queries
3. **GraphProtocolService**: Real-time blockchain data
4. **PhysicalWalletService**: Wallet management
5. **SpeakService**: Text-to-speech output

## 📝 Example Conversations

### Wallet Balance Check
```
User: "What's my portfolio worth?"
Pluto: "GM, portfolio tracker! Let me check your wallet balances and values."
Response: "Your portfolio is worth $1,250.00 USD with 12 tokens. Your largest holding is ETH at $850."
Voice: "Your portfolio is worth twelve hundred fifty dollars. Your biggest holding is ETH worth eight fifty."
```

### Token Price Query  
```
User: "How much USDC do I have?"
Pluto: "GM, market analyst! Let me get that token price data for you."
Response: "Your USDC (USD Coin) holding is worth $245.67 USD, representing 19.65% of your portfolio. You have 245.67 USDC."
Voice: "Your USDC is worth two forty-six dollars, which is twenty percent of your portfolio."
```

## 🔒 Security & Privacy

- **No Private Keys**: Only public addresses used for queries
- **Read-Only Access**: Market data queries only, no transactions
- **Local Storage**: Wallet info stored locally, not transmitted
- **Rate Limiting**: Prevents API abuse

## 🐛 Error Handling

The system gracefully handles:
- **No Wallets Found**: Offers to create wallet
- **Token Not Found**: Suggests available tokens
- **Network Issues**: Provides retry guidance
- **Invalid Queries**: Clarifies what information is needed

## 📊 Performance

- **Response Time**: < 2 seconds for most queries
- **Cache Support**: Reduces repeated API calls
- **Batch Queries**: Efficient data fetching
- **Fallback Modes**: Works with limited connectivity

---

*Ready to explore your crypto portfolio with Pluto? Just ask in natural language!* 🚀
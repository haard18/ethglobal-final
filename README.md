# Pyth Network API Documentation

This document provides comprehensive information about the Pyth Network price oracle APIs integrated into our Express server.

## Base URL
```
http://localhost:3000
```

## Available Endpoints

### 1. Get Available Assets
Returns all supported cryptocurrency pairs with their price feed IDs.

**Endpoint:** `GET /pyth/assets`

**Example Request:**
```bash
curl "http://localhost:3000/pyth/assets"
```

**Example Response:**
```json
{
  "success": true,
  "assets": [
    {
      "symbol": "ETH/USD",
      "priceId": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
    },
    {
      "symbol": "BTC/USD", 
      "priceId": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
    },
    {
      "symbol": "SOL/USD",
      "priceId": "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
    }
  ],
  "count": 8,
  "timestamp": "2025-09-27T04:37:40.508Z"
}
```

### 2. Validate Asset Support
Checks if a specific asset symbol is supported and returns its price feed ID.

**Endpoint:** `GET /pyth/validate/:assetSymbol`

**Parameters:**
- `assetSymbol` (URL encoded): Asset symbol to validate (e.g., `ETH%2FUSD` for `ETH/USD`)

**Example Request:**
```bash
curl "http://localhost:3000/pyth/validate/ETH%2FUSD"
```

**Example Response:**
```json
{
  "success": true,
  "asset": "ETH/USD",
  "isSupported": true,
  "priceId": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "timestamp": "2025-09-27T05:35:02.574Z"
}
```

### 3. Get Multiple Asset Prices
Fetches current prices for multiple cryptocurrency pairs.

**Endpoint:** `POST /pyth/prices`

**Request Body:**
```json
{
  "assets": ["ETH/USD", "BTC/USD"],
  "hermesEndpoint": "https://hermes.pyth.network"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:3000/pyth/prices" \
  -H "Content-Type: application/json" \
  -d '{
    "assets": ["ETH/USD", "BTC/USD"],
    "hermesEndpoint": "https://hermes.pyth.network"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "prices": [
    {
      "asset": "ETH/USD",
      "price": 4017.99013427,
      "confidence": 1.63380882,
      "publishTime": "2025-09-27T05:17:33.568Z",
      "priceId": "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
    },
    {
      "asset": "BTC/USD",
      "price": 109699.98,
      "confidence": 30.20500954,
      "publishTime": "2025-09-27T05:17:33.569Z",
      "priceId": "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
    }
  ]
}
```

### 4. Compare Asset Prices
Compares prices between two cryptocurrency pairs and calculates the difference.

**Endpoint Options:**
- `GET /pyth/compare/:asset1/:asset2?hermes=<endpoint>`
- `GET /pyth/compare?asset1=<symbol>&asset2=<symbol>&hermes=<endpoint>`

**Parameters:**
- `asset1`: First asset symbol (URL encoded in path)
- `asset2`: Second asset symbol (URL encoded in path)
- `hermes`: Optional Hermes endpoint (default: https://hermes.pyth.network)

**Example Requests:**
```bash
# Using path parameters
curl "http://localhost:3000/pyth/compare/ETH%2FUSD/BTC%2FUSD?hermes=https://hermes.pyth.network"

# Using query parameters
curl "http://localhost:3000/pyth/compare?asset1=ETH/USD&asset2=BTC/USD&hermes=https://hermes.pyth.network"
```

**Example Response:**
```json
{
  "success": true,
  "comparison": {
    "asset1": {
      "symbol": "ETH/USD",
      "price": 4019.54817654
    },
    "asset2": {
      "symbol": "BTC/USD", 
      "price": 109697.99
    },
    "difference": -105678.44182346,
    "percentDifference": -96.33580508034832
  },
  "timestamp": "2025-09-27T05:19:21.794Z"
}
```

## Supported Assets

The following cryptocurrency pairs are currently supported:

| Symbol | Description | Price Feed ID |
|--------|-------------|---------------|
| ETH/USD | Ethereum to USD | 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace |
| BTC/USD | Bitcoin to USD | 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43 |
| SOL/USD | Solana to USD | 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d |
| USDC/USD | USD Coin to USD | 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a |
| USDT/USD | Tether to USD | 0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca5c7cb9c98a33ad8f99bfed5b9 |
| MATIC/USD | Polygon to USD | 0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52 |
| AVAX/USD | Avalanche to USD | 0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7 |
| LINK/USD | Chainlink to USD | 0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221 |

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Description of the action performed",
  "data": "Response-specific data",
  "timestamp": "2025-09-27T05:35:02.574Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error Type",
  "message": "Detailed error description",
  "timestamp": "2025-09-27T05:35:02.574Z"
}
```

## Price Data Structure

Price data returned by the API includes:

```json
{
  "asset": "ETH/USD",
  "price": 4017.99013427,
  "confidence": 1.63380882,
  "publishTime": "2025-09-27T05:17:33.568Z",
  "priceId": "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
}
```

**Fields:**
- `asset`: Asset symbol (e.g., "ETH/USD")
- `price`: Current price in USD
- `confidence`: Price confidence interval
- `publishTime`: When the price was last updated (ISO 8601 format)
- `priceId`: Unique identifier for the price feed

## URL Encoding

When using asset symbols in URL paths, make sure to URL encode the forward slash:
- `ETH/USD` becomes `ETH%2FUSD`
- `BTC/USD` becomes `BTC%2FUSD`

## Error Handling

The API returns appropriate HTTP status codes:
- `200 OK`: Successful request
- `400 Bad Request`: Invalid parameters or missing required fields
- `404 Not Found`: Asset not found or not supported
- `500 Internal Server Error`: Server-side error

## Rate Limiting

Please be mindful of rate limits when making requests to avoid overwhelming the Pyth Network's Hermes API.

## Examples for Testing

Here are some quick curl commands for testing all endpoints:

```bash
# Get all available assets
curl "http://localhost:3000/pyth/assets"

# Validate ETH/USD support
curl "http://localhost:3000/pyth/validate/ETH%2FUSD"

# Get multiple prices
curl -X POST "http://localhost:3000/pyth/prices" \
  -H "Content-Type: application/json" \
  -d '{"assets": ["ETH/USD", "BTC/USD"]}'

# Compare two assets
curl "http://localhost:3000/pyth/compare/ETH%2FUSD/BTC%2FUSD"
```

---

For additional questions or support, please refer to the [Pyth Network Documentation](https://docs.pyth.network/) or contact the development team.
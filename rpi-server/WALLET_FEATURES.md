# Wallet Storage and Transfer Features

## 🏦 Persistent Wallet Storage

Wallets are now automatically saved to persistent storage and survive server restarts!

### Storage Location
- **Path**: `./wallet-storage/user-wallet.json`
- **Auto-created**: The directory is created automatically
- **Persistent**: Survives server restarts

### API Endpoints

#### Check Wallet Storage
```bash
GET /wallet/storage/check
```

Response when wallet exists:
```json
{
  "success": true,
  "hasWallet": true,
  "walletAddress": "0x...",
  "storagePath": "./wallet-storage/user-wallet.json",
  "message": "Wallet found in storage"
}
```

#### Create/Load Wallet
```bash
POST /wallet/generate
```
- If wallet exists in storage → loads existing wallet
- If no wallet exists → creates new wallet and saves it

## 💸 Transfer ETH

### Transfer to Address or ENS

#### Direct API Endpoint
```bash
POST /wallet/transfer
Content-Type: application/json

{
  "toAddress": "vitalik.eth", // or "0x..." address
  "amount": "0.1", // amount in ETH
  "fromAddress": "0x..." // optional, uses main wallet if not provided
}
```

#### Via GPT (Natural Language)
```bash
POST /gpt
Content-Type: application/json

{
  "text": "Send 0.5 ETH to vitalik.eth"
}
```

The GPT will automatically:
1. Parse the amount (0.5)
2. Parse the recipient (vitalik.eth)
3. Use your stored wallet
4. Execute the transfer
5. Provide voice feedback

### Example GPT Commands for Transfers
- "Transfer 0.1 ETH to alice.eth"
- "Send 2 ETH to 0x742d35Cc6634C0532925a3b8D25bc0aF3e07e747"
- "Please send 0.05 ETH to bob.eth"

## 🔧 Implementation Details

### New Files Structure
```
src/
├── functions/
│   ├── walletCreation.ts    # Wallet creation & transfer logic
│   └── walletStorage.ts     # Persistent storage utilities
├── services/
│   └── physicalWallet.ts    # Enhanced with storage & transfer
├── gpt/
│   └── service.ts           # Updated with transfer support
└── index.ts                 # New transfer endpoints
```

### Features Added

1. **Persistent Wallet Storage**
   - Automatic save/load from filesystem
   - Consistent path: `./wallet-storage/user-wallet.json`
   - Metadata support (creation date, labels, etc.)

2. **ENS Resolution**
   - Automatic ENS name resolution (e.g., `vitalik.eth`)
   - Fallback to direct address if not ENS

3. **Transfer Function**
   - Gas estimation and balance checking
   - Transaction confirmation waiting
   - Detailed error handling

4. **GPT Integration**
   - Natural language transfer parsing
   - Automatic parameter extraction
   - Voice feedback for transfers

### Error Handling
- Insufficient balance detection
- Gas cost calculation
- ENS resolution failures
- Invalid address validation
- Transaction failure recovery

## 🚀 Usage Examples

### 1. Start Server and Check Storage
```bash
# Start server
npm start

# Check if wallet exists
curl http://localhost:3000/wallet/storage/check
```

### 2. Create Wallet (Auto-saves)
```bash
curl -X POST http://localhost:3000/wallet/generate
```

### 3. Transfer via API
```bash
curl -X POST http://localhost:3000/wallet/transfer \
  -H "Content-Type: application/json" \
  -d '{
    "toAddress": "alice.eth",
    "amount": "0.1"
  }'
```

### 4. Transfer via GPT
```bash
curl -X POST http://localhost:3000/gpt \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Send 0.5 ETH to vitalik.eth"
  }'
```

### 5. Restart Server and Verify Persistence
```bash
# Stop server (Ctrl+C)
# Restart server
npm start

# Wallet should still be available
curl http://localhost:3000/wallet/storage/check
```

## 🔐 Security Notes

- Private keys are stored locally in `./wallet-storage/`
- **Never commit this folder to git**
- In production, consider encryption for storage
- Transfer functions validate all parameters before execution
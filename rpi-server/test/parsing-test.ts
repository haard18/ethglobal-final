import { WalletTransferService } from '../src/functions/walletTransfer.js';

console.log('🧪 Testing Intelligent Transfer Command Parsing\n');

const testCommands = [
    "transfer 0.2 eth to alex on ethereum",
    "please transfer alex 1 bnb on binance", 
    "can you transfer 0.1 eth to alex on base",
    "heyy buddy transfer 0.1 to alex on sepolia",
    "send 0.5 to vitalik on mainnet",
    "move 2.5 eth to bob on testnet",
    "I want to transfer 0.01 to alice on polygon",
    "please send 1.5 ethereum to charlie on arbitrum"
];

console.log('Testing various natural language patterns with chains:\n');

for (const command of testCommands) {
    console.log(`📝 Command: "${command}"`);
    const result = WalletTransferService.parseTransferCommand(command);
    
    if (result) {
        console.log(`✅ Parsed: ${result.amount} ${result.currency} → ${result.recipient} on ${result.chainName}`);
    } else {
        console.log(`❌ Failed to parse`);
    }
    console.log('---');
}

console.log('\n🎯 Testing Edge Cases:\n');

const edgeCases = [
    "transfer alex 0.2 eth on ethereum",           // Name before amount
    "send 1 to 0x742d35Cc6634C0532925a3b8D4F5E5D0C07F84c7 on base", // Address
    "please transfer 0.5",             // Missing recipient AND chain
    "send to alex on ethereum",        // Missing amount  
    "move some eth to bob on testnet", // Non-numeric amount
    "transfer 1 eth to alex",          // Missing chain (should fail)
];

for (const command of edgeCases) {
    console.log(`📝 Edge case: "${command}"`);
    const result = WalletTransferService.parseTransferCommand(command);
    
    if (result) {
        console.log(`✅ Parsed: ${result.amount} ${result.currency} → ${result.recipient} on ${result.chainName}`);
    } else {
        console.log(`❌ Failed to parse (expected for some cases)`);
    }
    console.log('---');
}
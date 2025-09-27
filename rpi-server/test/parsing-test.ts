import { WalletTransferService } from '../src/functions/walletTransfer.js';

console.log('🧪 Testing Intelligent Transfer Command Parsing\n');

const testCommands = [
    "transfer 0.2 eth to alex",
    "please transfer alex 1 eth", 
    "can you transfer 0.1 eth to alex",
    "heyy buddy transfer 0.1 to alex",
    "send 0.5 to vitalik",
    "move 2.5 eth to bob",
    "I want to transfer 0.01 to alice",
    "please send 1.5 ethereum to charlie"
];

console.log('Testing various natural language patterns:\n');

for (const command of testCommands) {
    console.log(`📝 Command: "${command}"`);
    const result = WalletTransferService.parseTransferCommand(command);
    
    if (result) {
        console.log(`✅ Parsed: ${result.amount} ETH → ${result.recipient}`);
    } else {
        console.log(`❌ Failed to parse`);
    }
    console.log('---');
}

console.log('\n🎯 Testing Edge Cases:\n');

const edgeCases = [
    "transfer alex 0.2 eth",           // Name before amount
    "send 1 to 0x742d35Cc6634C0532925a3b8D4F5E5D0C07F84c7", // Address
    "please transfer 0.5",             // Missing recipient
    "send to alex",                    // Missing amount  
    "move some eth to bob",            // Non-numeric amount
];

for (const command of edgeCases) {
    console.log(`📝 Edge case: "${command}"`);
    const result = WalletTransferService.parseTransferCommand(command);
    
    if (result) {
        console.log(`✅ Parsed: ${result.amount} ETH → ${result.recipient}`);
    } else {
        console.log(`❌ Failed to parse (expected for some cases)`);
    }
    console.log('---');
}
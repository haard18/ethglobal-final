/**
 * Test Market Data Integration
 * Tests the market data service and voice command routing
 */

import { marketDataService } from '../src/services/marketDataService.js';
import { MarketCommandRouter } from '../src/services/marketCommandRouter.js';
import { conversationManager } from '../src/services/conversationManager.js';

async function testMarketDataService() {
    console.log('🧪 Testing Market Data Service...\n');
    
    // Test health check
    console.log('1. Testing health check...');
    const isHealthy = await marketDataService.checkHealth();
    console.log(`   Health status: ${isHealthy ? '✅ Healthy' : '❌ Unavailable'}\n`);
    
    if (!isHealthy) {
        console.log('⚠️  Market data service unavailable - skipping other tests');
        return;
    }
    
    // Test market overview
    console.log('2. Testing market overview...');
    try {
        const overview = await marketDataService.getMarketOverview();
        console.log(`   Overview: ${overview}\n`);
    } catch (error) {
        console.log(`   Error: ${error}\n`);
    }
    
    // Test recent activity
    console.log('3. Testing recent market activity...');
    try {
        const activity = await marketDataService.getRecentMarketActivity(5);
        console.log(`   Recent Activity: ${activity}\n`);
    } catch (error) {
        console.log(`   Error: ${error}\n`);
    }
    
    // Test top gainers
    console.log('4. Testing top gainers...');
    try {
        const gainers = await marketDataService.getTopGainers(3);
        if (gainers?.tokens) {
            console.log(`   Top Gainers: ${gainers.tokens.length} tokens found`);
            gainers.tokens.forEach((token, i) => {
                console.log(`   ${i + 1}. ${token.symbol}: ${token.price_change_24h?.toFixed(2)}%`);
            });
        } else {
            console.log('   No gainer data available');
        }
        console.log('');
    } catch (error) {
        console.log(`   Error: ${error}\n`);
    }
}

async function testMarketCommandRouter() {
    console.log('🎤 Testing Market Command Router...\n');
    
    const router = new MarketCommandRouter();
    const sessionId = 'test-session';
    const context = conversationManager.getOrCreateContext(sessionId);
    
    const testCommands = [
        'market overview',
        'what is the market status',
        'show me recent market activity',
        'top gainers',
        'trending tokens',
        'price of 0x1234567890123456789012345678901234567890'
    ];
    
    for (const command of testCommands) {
        console.log(`Testing command: "${command}"`);
        try {
            const result = await router.processMarketCommand(command, context);
            console.log(`  Success: ${result.success}`);
            console.log(`  Response: ${result.response.substring(0, 100)}${result.response.length > 100 ? '...' : ''}`);
            console.log('');
        } catch (error) {
            console.log(`  Error: ${error}`);
            console.log('');
        }
    }
}

async function testMarketDetection() {
    console.log('🔍 Testing Market Command Detection...\n');
    
    const testPhrases = [
        { text: 'what is the price of ethereum', expected: true },
        { text: 'show me market overview', expected: true },
        { text: 'create a new wallet', expected: false },
        { text: 'recent trading activity', expected: true },
        { text: 'top performing tokens', expected: true },
        { text: 'send 0.1 ETH to someone', expected: false },
        { text: 'trending coins today', expected: true }
    ];
    
    for (const phrase of testPhrases) {
        const isMarket = MarketCommandRouter.isMarketCommand(phrase.text);
        const status = isMarket === phrase.expected ? '✅' : '❌';
        console.log(`${status} "${phrase.text}" -> Market: ${isMarket} (Expected: ${phrase.expected})`);
    }
    console.log('');
}

async function main() {
    console.log('🚀 Market Data Integration Test Suite\n');
    console.log('=' .repeat(50) + '\n');
    
    await testMarketDetection();
    await testMarketDataService();
    await testMarketCommandRouter();
    
    console.log('✅ Test suite completed!');
    process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error: any) => {
    console.error('❌ Unhandled rejection:', error);
    process.exit(1);
});

// Run tests
main().catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
});
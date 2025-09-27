#!/usr/bin/env node

/**
 * Test script for wallet GPT integration
 * Tests various wallet-related queries to ensure GPT correctly identifies actions
 */

import { gptService } from '../src/gpt/service.ts';

const testQueries = [
    // Balance queries
    "What's my wallet balance?",
    "How much ETH do I have?",
    "Show me my portfolio value",
    
    // Token price queries
    "What's the price of USDC in my wallet?",
    "How much is my BTC worth?",
    "Tell me about my WETH holdings",
    
    // Portfolio queries
    "Show me my complete portfolio",
    "What are my top token holdings?",
    "Give me a portfolio breakdown",
    
    // Summary queries
    "Give me a wallet summary",
    "What's in my wallet?",
    "Show me my crypto overview",
    
    // General conversation (should not trigger actions)
    "Hello, how are you?",
    "What is blockchain?",
    "Explain DeFi to me",
];

async function testGPTIntegration() {
    console.log('🧪 Testing GPT Wallet Integration...\n');
    
    for (const query of testQueries) {
        console.log(`📝 Testing: "${query}"`);
        
        try {
            const result = await gptService.analyzeUserIntent(query);
            
            console.log(`   Action Detected: ${result.isAction ? '✅ YES' : '❌ NO'}`);
            if (result.isAction) {
                console.log(`   Action Type: ${result.action}`);
                console.log(`   Parameters: ${JSON.stringify(result.parameters || {})}`);
                console.log(`   Response: ${result.textResponse}`);
            } else {
                console.log(`   General Response: ${result.textResponse?.substring(0, 100)}...`);
            }
            
            console.log('   ─────────────────────────────────────');
        } catch (error) {
            console.log(`   ❌ ERROR: ${error}`);
            console.log('   ─────────────────────────────────────');
        }
    }
    
    console.log('\n🎉 GPT Integration Test Complete!');
}

// Run the test
testGPTIntegration().catch(console.error);
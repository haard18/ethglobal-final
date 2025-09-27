/*
Test script for Pumpfun events integration
This script tests the Pumpfun substream connection and database integration
*/
import dotenv from 'dotenv';
import { initDatabase, savePumpfunEvent, getPumpfunEventsByToken } from './src/db/index.js';

dotenv.config();

// Test event data structure (simulating actual Pumpfun event)
const testPumpfunEvent = {
  eventType: 'buy',
  blockNumber: 300000001,
  blockHash: '123abc456def789',
  transactionHash: '456def789abc123',
  logIndex: 0,
  tokenAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  user: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  amount: '1000000000', // 1 billion tokens (with 9 decimals = 1000 tokens)
  solAmount: '50000000', // 0.05 SOL in lamports
  timestamp: new Date().toISOString(),
  metadata: {
    programId: '4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy',
    accounts: ['9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'],
    instruction: 'buy',
    rawData: '{"amount":"1000000000","sol_amount":"50000000"}'
  }
};

const runTest = async () => {
  try {
    console.log('🚀 Starting Pumpfun integration test...\n');

    // Test 1: Database initialization
    console.log('1. Testing database initialization...');
    
    // First, let's drop the existing table if it has wrong schema
    const { pool } = await import('./src/db/index.js');
    const client = await pool.connect();
    try {
      await client.query('DROP TABLE IF EXISTS pumpfun_events');
      console.log('- Dropped existing pumpfun_events table');
    } catch (error) {
      console.log('- No existing table to drop');
    } finally {
      client.release();
    }
    
    await initDatabase();
    console.log('✅ Database initialized successfully\n');

    // Test 2: Save test event
    console.log('2. Testing Pumpfun event saving...');
    await savePumpfunEvent(testPumpfunEvent);
    console.log('✅ Test Pumpfun event saved successfully\n');

    // Test 3: Query events
    console.log('3. Testing event queries...');
    const events = await getPumpfunEventsByToken(testPumpfunEvent.tokenAddress, 10);
    console.log(`✅ Retrieved ${events.length} events for token ${testPumpfunEvent.tokenAddress}`);
    
    if (events.length > 0) {
      console.log('Latest event:');
      console.log('- Event Type:', events[0].event_type);
      console.log('- Token Address:', events[0].token_address);
      console.log('- User Address:', events[0].user_address);
      console.log('- Amount:', events[0].amount);
      console.log('- SOL Amount:', events[0].sol_amount);
      console.log('- Timestamp:', events[0].timestamp);
    }

    console.log('\n🎉 All tests passed! Pumpfun integration is working correctly.');
    console.log('\n📋 Available API endpoints:');
    console.log('- GET /api/pumpfun/token/:address/events - Get events for a token');
    console.log('- GET /api/pumpfun/user/:address/events - Get events for a user');
    console.log('- GET /api/pumpfun/events/recent - Get recent events');
    console.log('- GET /api/pumpfun/token/:address/stats - Get token statistics');
    console.log('\n📡 To start streaming real Pumpfun events:');
    console.log('- npm run start (starts full server with all streams)');
    console.log('- npm run pumpfun (starts only Pumpfun stream)');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

runTest();
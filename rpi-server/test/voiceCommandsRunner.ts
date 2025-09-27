#!/usr/bin/env node

/**
 * Pluto Voice Commands Test Script
 * A standalone test runner for all voice commands
 * Run with: npm run test:voice or npx tsx test/voiceCommandsRunner.ts
 */

import VoiceCommandRouter from '../src/services/voiceCommandRouter.js';
import { PhysicalWalletService } from '../src/services/physicalWallet.js';
import { WalletQueryService } from '../src/services/walletQueryService.js';
import { conversationManager } from '../src/services/conversationManager.js';

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

interface TestResult {
    command: string;
    status: 'PASS' | 'FAIL';
    message: string;
    duration: number;
}

class VoiceCommandTester {
    private voiceCommandRouter: VoiceCommandRouter;
    private testSessionId: string;
    private testResults: {
        passed: number;
        failed: number;
        total: number;
        details: TestResult[];
    };

    constructor() {
        console.log(`${colors.cyan}${colors.bright}🎤 Initializing Pluto Voice Command Test Suite${colors.reset}\n`);
        
        const physicalWalletService = new PhysicalWalletService();
        const walletQueryService = new WalletQueryService(physicalWalletService);
        this.voiceCommandRouter = new VoiceCommandRouter(physicalWalletService, walletQueryService);
        
        this.testSessionId = `test_${Date.now()}`;
        this.testResults = {
            passed: 0,
            failed: 0,
            total: 0,
            details: []
        };
    }

    async testCommand(command: string, expectedSuccess: boolean = true): Promise<boolean> {
        const startTime = Date.now();
        
        try {
            console.log(`${colors.yellow}Testing: "${command}"${colors.reset}`);
            
            const result = await this.voiceCommandRouter.processVoiceCommand(command, this.testSessionId);
            const duration = Date.now() - startTime;
            
            const success = result.success === expectedSuccess;
            
            if (success) {
                console.log(`${colors.green}✅ PASS${colors.reset} (${duration}ms): ${result.spokenMessage.substring(0, 80)}...`);
                this.testResults.passed++;
                this.testResults.details.push({
                    command,
                    status: 'PASS',
                    message: result.spokenMessage,
                    duration
                });
            } else {
                console.log(`${colors.red}❌ FAIL${colors.reset} (${duration}ms): Expected success=${expectedSuccess}, got ${result.success}`);
                this.testResults.failed++;
                this.testResults.details.push({
                    command,
                    status: 'FAIL',
                    message: result.spokenMessage || 'No response',
                    duration
                });
            }
            
            this.testResults.total++;
            return success;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.log(`${colors.red}❌ ERROR${colors.reset} (${duration}ms): ${error instanceof Error ? error.message : 'Unknown error'}`);
            
            this.testResults.failed++;
            this.testResults.total++;
            this.testResults.details.push({
                command,
                status: 'FAIL',
                message: error instanceof Error ? error.message : 'Unknown error',
                duration
            });
            
            return false;
        }
    }

    async runAllTests(): Promise<void> {
        console.log(`${colors.blue}${colors.bright}🚀 Running Comprehensive Voice Command Tests${colors.reset}\n`);

        // Test Categories
        await this.testWalletManagement();
        await this.testBalanceAndPortfolio();
        await this.testTransactions();
        await this.testMarketData();
        await this.testAdvancedQueries();
        await this.testConversationFlow();
        await this.testEdgeCases();

        this.printSummary();
    }

    async testWalletManagement(): Promise<void> {
        console.log(`\n${colors.magenta}${colors.bright}💰 Testing Wallet Management Commands${colors.reset}`);
        
        const commands = [
            'Create a new wallet',
            'Generate a wallet',
            'Make me a wallet',
            'Show my wallets',
            'What wallets do I have?',
            'List my wallets',
            'Wallet information',
            'How many wallets do I have?'
        ];

        for (const command of commands) {
            await this.testCommand(command);
            await this.delay(100); // Small delay between tests
        }
    }

    async testBalanceAndPortfolio(): Promise<void> {
        console.log(`\n${colors.magenta}${colors.bright}💳 Testing Balance & Portfolio Commands${colors.reset}`);
        
        const commands = [
            'Check my balance',
            "What's my ETH balance?",
            'Show my balance',
            'Show my portfolio',
            'Portfolio value',
            'Show my token holdings',
            'What tokens do I own?',
            'Token balances'
        ];

        for (const command of commands) {
            await this.testCommand(command);
            await this.delay(100);
        }
    }

    async testTransactions(): Promise<void> {
        console.log(`\n${colors.magenta}${colors.bright}💸 Testing Transaction Commands${colors.reset}`);
        
        const commands = [
            'Show recent transactions',
            'Transaction history',
            'Wallet activity',
            'Recent activity',
            'Show incoming transactions',
            'Show outgoing transactions'
        ];

        // Test transfer commands (these might fail due to lack of setup, but should parse correctly)
        const transferCommands = [
            'Send 0.01 ETH to alice',
            'Transfer 0.05 ETH to bob'
        ];

        for (const command of commands) {
            await this.testCommand(command);
            await this.delay(100);
        }

        console.log(`${colors.yellow}Testing transfer commands (may fail without wallet setup):${colors.reset}`);
        for (const command of transferCommands) {
            await this.testCommand(command, false); // Expect these to potentially fail
            await this.delay(100);
        }
    }

    async testMarketData(): Promise<void> {
        console.log(`\n${colors.magenta}${colors.bright}📊 Testing Market Data Commands${colors.reset}`);
        
        const commands = [
            'Market overview',
            'Market summary',
            'How is the market?',
            "What's the price of USDC?",
            'Price of Ethereum',
            'Recent market activity',
            'Top gainers',
            'Top losers',
            'Trending tokens',
            "What's trending?"
        ];

        for (const command of commands) {
            await this.testCommand(command);
            await this.delay(100);
        }
    }

    async testAdvancedQueries(): Promise<void> {
        console.log(`\n${colors.magenta}${colors.bright}🔍 Testing Advanced Query Commands${colors.reset}`);
        
        const commands = [
            'Wallet summary',
            'Portfolio insights',
            'Investment summary',
            'Monitor my wallet',
            'Price over last 24 hours',
            'Price change over 24 hours'
        ];

        for (const command of commands) {
            await this.testCommand(command);
            await this.delay(100);
        }
    }

    async testConversationFlow(): Promise<void> {
        console.log(`\n${colors.magenta}${colors.bright}🗣️ Testing Conversation & Control Commands${colors.reset}`);
        
        const conversationCommands = [
            'Help',
            'What can you do?',
            'Available commands',
            'Options'
        ];

        const sessionCommands = [
            'Goodbye',
            'Exit',
            'Stop'
        ];

        for (const command of conversationCommands) {
            await this.testCommand(command);
            await this.delay(100);
        }

        console.log(`${colors.yellow}Testing session control commands:${colors.reset}`);
        for (const command of sessionCommands) {
            await this.testCommand(command);
            // Reset session after each exit command
            this.testSessionId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await this.delay(100);
        }
    }

    async testEdgeCases(): Promise<void> {
        console.log(`\n${colors.magenta}${colors.bright}🧪 Testing Edge Cases${colors.reset}`);
        
        const edgeCases = [
            { command: '', description: 'Empty command' },
            { command: 'asdfghjkl', description: 'Random text' },
            { command: '12345', description: 'Numbers only' },
            { command: 'CREATE A NEW WALLET!!!', description: 'All caps with punctuation' },
            { command: 'send eth', description: 'Incomplete transfer' },
            { command: 'price of', description: 'Incomplete price query' }
        ];

        for (const testCase of edgeCases) {
            console.log(`${colors.yellow}Edge case: ${testCase.description}${colors.reset}`);
            await this.testCommand(testCase.command);
            await this.delay(100);
        }
    }

    private async testConfirmationFlow(): Promise<void> {
        console.log(`\n${colors.magenta}${colors.bright}✅ Testing Confirmation Flow${colors.reset}`);
        
        // Test a command that might require confirmation
        console.log(`${colors.yellow}Testing transfer that might require confirmation:${colors.reset}`);
        const result = await this.voiceCommandRouter.processVoiceCommand('Send 0.5 ETH to alice', this.testSessionId);
        
        if (result.requiresConfirmation) {
            console.log(`${colors.green}✅ Confirmation required as expected${colors.reset}`);
            
            // Test confirmation responses
            await this.testCommand('yes, confirm');
            conversationManager.clearPendingConfirmation(this.testSessionId);
            
            await this.testCommand('cancel');
            conversationManager.clearPendingConfirmation(this.testSessionId);
        } else {
            console.log(`${colors.yellow}ℹ️ No confirmation required (expected for this test environment)${colors.reset}`);
        }
    }

    printSummary(): void {
        console.log(`\n${colors.cyan}${colors.bright}📊 TEST SUMMARY${colors.reset}`);
        console.log(`${colors.bright}═══════════════════════════════════════════${colors.reset}`);
        
        const passRate = this.testResults.total > 0 ? (this.testResults.passed / this.testResults.total * 100).toFixed(1) : '0.0';
        
        console.log(`Total Tests: ${colors.bright}${this.testResults.total}${colors.reset}`);
        console.log(`Passed: ${colors.green}${this.testResults.passed}${colors.reset}`);
        console.log(`Failed: ${colors.red}${this.testResults.failed}${colors.reset}`);
        console.log(`Pass Rate: ${colors.bright}${passRate}%${colors.reset}`);

        // Calculate average response time
        const totalDuration = this.testResults.details.reduce((sum, detail) => sum + detail.duration, 0);
        const avgDuration = this.testResults.total > 0 ? (totalDuration / this.testResults.total).toFixed(1) : '0.0';
        console.log(`Average Response Time: ${colors.bright}${avgDuration}ms${colors.reset}`);

        // Show failed tests
        const failedTests = this.testResults.details.filter(detail => detail.status === 'FAIL');
        if (failedTests.length > 0) {
            console.log(`\n${colors.red}${colors.bright}Failed Tests:${colors.reset}`);
            failedTests.forEach((test, index) => {
                console.log(`${colors.red}${index + 1}. "${test.command}"${colors.reset}`);
                console.log(`   ${test.message.substring(0, 100)}...`);
            });
        }

        // Performance insights
        const slowTests = this.testResults.details
            .filter(detail => detail.duration > 3000)
            .sort((a, b) => b.duration - a.duration);
            
        if (slowTests.length > 0) {
            console.log(`\n${colors.yellow}${colors.bright}Slow Tests (>3s):${colors.reset}`);
            slowTests.slice(0, 5).forEach((test, index) => {
                console.log(`${colors.yellow}${index + 1}. "${test.command}" (${test.duration}ms)${colors.reset}`);
            });
        }

        console.log(`\n${colors.cyan}${colors.bright}🎉 Voice Command Testing Complete!${colors.reset}`);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
${colors.cyan}${colors.bright}Pluto Voice Commands Test Runner${colors.reset}

Usage:
  npm run test:voice                           Run all tests
  npx tsx test/voiceCommandsRunner.ts --single "command"  Test single command
  npx tsx test/voiceCommandsRunner.ts --category wallet   Test specific category
  npx tsx test/voiceCommandsRunner.ts --help             Show this help

Categories:
  wallet      Wallet management commands
  balance     Balance and portfolio commands  
  transfer    Transaction commands
  market      Market data commands
  advanced    Advanced query commands
  conversation Conversation control commands
  edge        Edge cases and error handling

Examples:
  npm run test:voice
  npx tsx test/voiceCommandsRunner.ts --single "check my balance"
  npx tsx test/voiceCommandsRunner.ts --category market
        `);
        return;
    }

    const tester = new VoiceCommandTester();

    if (args.includes('--single')) {
        const commandIndex = args.indexOf('--single') + 1;
        const command = args[commandIndex];
        if (command) {
            console.log(`${colors.cyan}Testing single command: "${command}"${colors.reset}\n`);
            await tester.testCommand(command);
            tester.printSummary();
        } else {
            console.log(`${colors.red}Error: Please provide a command after --single${colors.reset}`);
        }
        return;
    }

    if (args.includes('--category')) {
        const categoryIndex = args.indexOf('--category') + 1;
        const category = args[categoryIndex];
        if (category) {
            console.log(`${colors.cyan}Testing category: "${category}"${colors.reset}\n`);
            
            switch (category.toLowerCase()) {
                case 'wallet':
                    await tester.testWalletManagement();
                    break;
                case 'balance':
                    await tester.testBalanceAndPortfolio();
                    break;
                case 'transfer':
                    await tester.testTransactions();
                    break;
                case 'market':
                    await tester.testMarketData();
                    break;
                case 'advanced':
                    await tester.testAdvancedQueries();
                    break;
                case 'conversation':
                    await tester.testConversationFlow();
                    break;
                case 'edge':
                    await tester.testEdgeCases();
                    break;
                default:
                    console.log(`${colors.red}Unknown category: ${category}${colors.reset}`);
                    return;
            }
            
            tester.printSummary();
        } else {
            console.log(`${colors.red}Error: Please provide a category after --category${colors.reset}`);
        }
        return;
    }

    // Run all tests
    await tester.runAllTests();
}

// Export for use as module
export { VoiceCommandTester };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error(`${colors.red}Test runner error: ${error}${colors.reset}`);
        process.exit(1);
    });
}
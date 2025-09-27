import { ethers } from 'ethers';
import { EthereumWalletGenerator, type WalletInfo, type TransferResult } from './walletCreation.js';
import { WalletStorageService } from './walletStorage.js';
import { showDisplayMessage } from '../utils/display.js';
import { speakText } from '../output/speak.js';

export interface TransferRequest {
    amount: string;
    recipient: string;
    chainName: string; // Now required!
    currency: string;  // ETH, BNB, etc.
    fromWalletIndex?: number;
}

export interface TransferValidation {
    isValid: boolean;
    error?: string;
    balance?: string;
    requiredAmount?: string;
}

export class WalletTransferService {
    static parseTransferCommand(command: string): TransferRequest | null {
        try {
            console.log(`🎯 Parsing command: "${command}"`);
            
            const normalizedCommand = command.toLowerCase().trim();
            let amount: string = '';
            let recipient: string = '';
            let chainName: string = '';
            let currency: string = '';
            
            // Define chain mappings
            const chainMappings: { [key: string]: string } = {
                // Ethereum
                'ethereum': 'ethereum',
                'eth': 'ethereum', 
                'mainnet': 'ethereum',
                'sepolia': 'sepolia',
                'testnet': 'sepolia',
                'goerli': 'goerli',
                
                // Binance Smart Chain
                'binance': 'bsc',
                'bsc': 'bsc',
                'bnb': 'bsc',
                'smartchain': 'bsc',
                
                // Base
                'base': 'base',
                'coinbase': 'base',
                
                // Polygon
                'polygon': 'polygon',
                'matic': 'polygon',
                'poly': 'polygon',
                
                // Arbitrum
                'arbitrum': 'arbitrum',
                'arb': 'arbitrum',
                
                // Optimism
                'optimism': 'optimism',
                'op': 'optimism'
            };
            
            // Define currency mappings
            const currencyMappings: { [key: string]: string } = {
                'eth': 'ETH',
                'ethereum': 'ETH',
                'ether': 'ETH',
                'bnb': 'BNB',
                'binance': 'BNB',
                'matic': 'MATIC',
                'polygon': 'MATIC'
            };
            
            const numberMatches = normalizedCommand.match(/\b(\d+(?:\.\d+)?)\b/g);
            console.log(`🔢 Found numbers: ${numberMatches?.join(', ') || 'none'}`);
            
            const words = normalizedCommand.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 0);
            console.log(`📝 Words: ${words.join(', ')}`);
            
            // Detect chain name
            for (const word of words) {
                if (chainMappings[word]) {
                    chainName = chainMappings[word];
                    console.log(`🔗 Found chain: ${word} → ${chainName}`);
                    break;
                }
            }
            
            // Special pattern: "on [chain]"
            const onChainMatch = normalizedCommand.match(/\bon\s+(\w+)/i);
            if (onChainMatch && onChainMatch[1]) {
                const chainKey = onChainMatch[1].toLowerCase();
                if (chainMappings[chainKey]) {
                    chainName = chainMappings[chainKey];
                    console.log(`🎯 Found "on chain" pattern: ${onChainMatch[1]} → ${chainName}`);
                }
            }
            
            // Detect currency
            for (const word of words) {
                if (currencyMappings[word]) {
                    currency = currencyMappings[word];
                    console.log(`💱 Found currency: ${word} → ${currency}`);
                    break;
                }
            }
            
            // Default currency to ETH if not specified
            if (!currency) {
                currency = 'ETH';
                console.log(`💱 Default currency: ${currency}`);
            }
            
            // If no chain specified, return null (chain is now mandatory)
            if (!chainName) {
                console.log('❌ No chain specified - chain is mandatory for transfers');
                return null;
            }
            
            const potentialNames: string[] = [];
            const excludeWords = [
                'transfer', 'send', 'move', 'to', 'from', 'the', 'a', 'an', 'and', 'or', 'but', 'with', 'for', 'at', 'in', 'on', 'by',
                'please', 'can', 'you', 'could', 'would', 'will', 'i', 'me', 'my', 'we', 'us', 'our',
                'eth', 'ethereum', 'ether', 'coin', 'token', 'crypto', 'currency', 'bnb', 'binance', 'matic', 'polygon',
                'hey', 'heyy', 'hi', 'hello', 'buddy', 'friend', 'mate',
                'want', 'need', 'like', 'should', 'must', 'have', 'get', 'make', 'do',
                'some', 'any', 'all', 'one', 'two', 'three', 'much', 'many', 'more', 'less',
                'chain', 'network', 'mainnet', 'testnet', 'sepolia', 'goerli', 'base', 'arbitrum', 'optimism', 'bsc', 'smartchain'
            ];
            
            for (const word of words) {
                const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
                if (cleanWord.length >= 2 && 
                    !excludeWords.includes(cleanWord) && 
                    !/^\d/.test(cleanWord) && 
                    cleanWord.length <= 20) {
                    potentialNames.push(cleanWord);
                }
            }
            
            console.log(`👤 Potential names: ${potentialNames.join(', ')}`);
            
            if (numberMatches && numberMatches.length > 0) {
                amount = numberMatches[0];
                console.log(`💰 Selected amount: ${amount}`);
            } else {
                console.log('❌ No amount found');
                return null;
            }
            
            if (potentialNames.length > 0) {
                const toMatch = normalizedCommand.match(/\bto\s+([a-zA-Z]+)/i);
                if (toMatch && toMatch[1]) {
                    const nameAfterTo = toMatch[1].toLowerCase().replace(/[^\w]/g, '');
                    if (potentialNames.includes(nameAfterTo)) {
                        recipient = `${nameAfterTo}.eth`;
                        console.log(`🎯 Found name after "to": ${nameAfterTo} → ${recipient}`);
                    }
                }
                
                if (!recipient) {
                    const commonNames = ['alex', 'alice', 'bob', 'charlie', 'david', 'emma', 'frank', 'grace', 'henry', 'ivy', 
                                       'jack', 'kate', 'liam', 'mia', 'noah', 'olivia', 'peter', 'quinn', 'ryan', 'sara',
                                       'vitalik', 'satoshi', 'nick', 'joe', 'max', 'sam', 'tom', 'ben', 'dan', 'tim'];
                    
                    let bestName = '';
                    let bestScore = 0;
                    
                    for (const name of potentialNames) {
                        let score = name.length;
                        if (commonNames.includes(name)) {
                            score += 10;
                        }
                        if (score > bestScore) {
                            bestScore = score;
                            bestName = name;
                        }
                    }
                    
                    if (bestName) {
                        recipient = `${bestName}.eth`;
                        console.log(`🏆 Best candidate: ${bestName} → ${recipient} (score: ${bestScore})`);
                    }
                }
            }
            
            if (!recipient) {
                const addressMatch = normalizedCommand.match(/(0x[a-fA-F0-9]{40})/i);
                if (addressMatch && addressMatch[1]) {
                    recipient = addressMatch[1].toLowerCase();
                    console.log(`📍 Found Ethereum address: ${recipient}`);
                }
            }
            
            if (!recipient) {
                console.log('❌ No recipient found');
                return null;
            }
            
            const result = {
                amount,
                recipient,
                chainName,
                currency,
                fromWalletIndex: 0
            };
            
            console.log(`✅ Parsed result:`, result);
            return result;
            
        } catch (error) {
            console.error('Error parsing transfer command:', error);
            return null;
        }
    }

    static async validateTransfer(request: TransferRequest): Promise<TransferValidation> {
        try {
            const wallets = WalletStorageService.getAllWallets();
            if (!wallets || wallets.length === 0) {
                return {
                    isValid: false,
                    error: 'No wallets found. Please create a wallet first.'
                };
            }

            const walletIndex = request.fromWalletIndex || 0;
            if (walletIndex >= wallets.length) {
                return {
                    isValid: false,
                    error: `Wallet index ${walletIndex} not found.`
                };
            }

            const wallet = wallets[walletIndex];
            if (!wallet) {
                return {
                    isValid: false,
                    error: `Wallet at index ${walletIndex} not found.`
                };
            }
            
            // Get RPC URL based on chain
            const getRpcUrl = (chain: string): string => {
                const rpcUrls: { [key: string]: string } = {
                    'ethereum': 'https://eth.llamarpc.com',
                    'sepolia': 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
                    'goerli': 'https://goerli.infura.io/v3/YOUR_INFURA_KEY',
                    'bsc': 'https://bsc-dataseed1.binance.org',
                    'base': 'https://mainnet.base.org',
                    'polygon': 'https://polygon-rpc.com',
                    'arbitrum': 'https://arb1.arbitrum.io/rpc',
                    'optimism': 'https://mainnet.optimism.io'
                };
                return rpcUrls[chain] || 'https://eth.llamarpc.com';
            };
            
            const provider = new ethers.JsonRpcProvider(getRpcUrl(request.chainName));
            const balance = await provider.getBalance(wallet.walletInfo.address);
            const balanceInEth = ethers.formatEther(balance);
            
            const requiredAmount = request.amount;
            const requiredAmountBN = ethers.parseEther(requiredAmount);
            
            const gasBuffer = ethers.parseEther('0.001');
            const totalRequired = requiredAmountBN + gasBuffer;
            
            if (balance < totalRequired) {
                return {
                    isValid: false,
                    error: `Insufficient balance. Available: ${balanceInEth} ETH, Required: ${ethers.formatEther(totalRequired)} ETH (including gas)`,
                    balance: balanceInEth,
                    requiredAmount: ethers.formatEther(totalRequired)
                };
            }
            
            return {
                isValid: true,
                balance: balanceInEth,
                requiredAmount: ethers.formatEther(totalRequired)
            };
            
        } catch (error) {
            console.error('Error validating transfer:', error);
            return {
                isValid: false,
                error: `Validation error: ${error}`
            };
        }
    }

    static async executeTransfer(request: TransferRequest): Promise<TransferResult> {
        try {
            console.log('🚀 Executing transfer:', request);
            
            const validation = await this.validateTransfer(request);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: validation.error || 'Transfer validation failed'
                };
            }

            const wallets = WalletStorageService.getAllWallets();
            const storedWallet = wallets[request.fromWalletIndex || 0];
            if (!storedWallet) {
                return {
                    success: false,
                    error: `Wallet at index ${request.fromWalletIndex || 0} not found.`
                };
            }
            
            // Get RPC URL based on chain
            const getRpcUrl = (chain: string): string => {
                const rpcUrls: { [key: string]: string } = {
                    'ethereum': 'https://eth.llamarpc.com',
                    'sepolia': 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY',
                    'goerli': 'https://goerli.infura.io/v3/YOUR_INFURA_KEY',
                    'bsc': 'https://bsc-dataseed1.binance.org',
                    'base': 'https://mainnet.base.org',
                    'polygon': 'https://polygon-rpc.com',
                    'arbitrum': 'https://arb1.arbitrum.io/rpc',
                    'optimism': 'https://mainnet.optimism.io'
                };
                return rpcUrls[chain] || 'https://eth.llamarpc.com';
            };
            
            const provider = new ethers.JsonRpcProvider(getRpcUrl(request.chainName));
            const ethersWallet = new ethers.Wallet(storedWallet.walletInfo.privateKey, provider);
            
            let toAddress: string;
            
            if (request.recipient.endsWith('.eth')) {
                console.log(`🔍 Resolving ENS name: ${request.recipient}`);
                const resolvedAddress = await provider.resolveName(request.recipient);
                if (!resolvedAddress) {
                    return {
                        success: false,
                        error: `Could not resolve ENS name: ${request.recipient}`
                    };
                }
                toAddress = resolvedAddress;
                console.log(`✅ ENS resolved: ${request.recipient} → ${toAddress}`);
            } else if (ethers.isAddress(request.recipient)) {
                toAddress = request.recipient;
            } else {
                return {
                    success: false,
                    error: `Invalid recipient: ${request.recipient}. Must be ENS name or valid Ethereum address.`
                };
            }
            
            const amountInWei = ethers.parseEther(request.amount);
            
            const tx = {
                to: toAddress,
                value: amountInWei,
                gasLimit: 21000n
            };
            
            console.log('📝 Transaction details:', {
                from: storedWallet.walletInfo.address,
                to: toAddress,
                amount: request.amount + ' ETH',
                amountInWei: amountInWei.toString()
            });
            
            const transaction = await ethersWallet.sendTransaction(tx);
            console.log(`📤 Transaction sent: ${transaction.hash}`);
            
            console.log('⏳ Waiting for confirmation...');
            const receipt = await transaction.wait();
            
            if (receipt?.status === 1) {
                const result = {
                    success: true,
                    message: `Successfully transferred ${request.amount} ETH to ${request.recipient}`,
                    transactionHash: transaction.hash,
                    from: storedWallet.walletInfo.address,
                    to: toAddress,
                    amount: request.amount,
                    gasUsed: receipt.gasUsed?.toString()
                };
                
                console.log('✅ Transfer successful:', result);
                return result;
            } else {
                return {
                    success: false,
                    error: `Transaction failed with status: ${receipt?.status}`,
                    transactionHash: transaction.hash
                };
            }
            
        } catch (error) {
            console.error('Error executing transfer:', error);
            return {
                success: false,
                error: `Transfer execution failed: ${error}`
            };
        }
    }

    static async processTransferCommand(command: string): Promise<TransferResult> {
        try {
            console.log('🎤 Processing transfer command:', command);
            
            const request = this.parseTransferCommand(command);
            if (!request) {
                const errorMsg = 'Sorry, I could not understand the transfer command. Please specify the amount, recipient, and chain clearly. For example: "transfer 0.1 eth to alex on ethereum"';
                await showDisplayMessage({ text: errorMsg });
                await speakText(errorMsg);
                return {
                    success: false,
                    error: errorMsg
                };
            }
            
            console.log('📋 Parsed request:', request);
            
            const confirmMsg = `Understood: Transfer ${request.amount} ${request.currency} to ${request.recipient} on ${request.chainName}. Processing...`;
            await showDisplayMessage({ text: confirmMsg });
            await speakText(confirmMsg);
            
            const result = await this.executeTransfer(request);
            
            if (result.success) {
                const successMsg = `Transfer successful! Sent ${request.amount} ${request.currency} to ${request.recipient} on ${request.chainName}. Transaction hash: ${result.transactionHash?.slice(0, 10)}...`;
                await showDisplayMessage({ text: `✅ ${successMsg}`, emotion: 'happy' });
                await speakText(`Success! ${request.amount} ${request.currency} has been transferred to ${request.recipient} on ${request.chainName}.`);
            } else {
                const errorMsg = result.error || 'Transfer failed for unknown reason';
                console.error('❌ Transfer failed:', errorMsg);
                
                if (errorMsg.includes('Insufficient balance')) {
                    await showDisplayMessage({ text: `💰 ${errorMsg}`, emotion: 'sad' });
                    await speakText(`Sorry, insufficient balance. ${errorMsg.split('Available: ')[1]}`);
                } else if (errorMsg.includes('Could not resolve ENS')) {
                    await showDisplayMessage({ text: `🔍 ${errorMsg}`, emotion: 'confused' });
                    await speakText(`Sorry, I couldn't find that ENS name. Please check the spelling.`);
                } else {
                    await showDisplayMessage({ text: `❌ ${errorMsg}`, emotion: 'angry' });
                    await speakText(`Sorry, the transfer failed. ${errorMsg}`);
                }
            }
            
            return result;
            
        } catch (error) {
            console.error('Error processing transfer command:', error);
            const errorMsg = `Error processing transfer: ${error}`;
            await showDisplayMessage({ text: `❌ ${errorMsg}`, emotion: 'angry' });
            await speakText('Sorry, there was an error processing your transfer request.');
            return {
                success: false,
                error: errorMsg
            };
        }
    }
}

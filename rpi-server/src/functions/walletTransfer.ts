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

export interface ParsedTransferInfo {
    request?: TransferRequest;
    missingInfo?: {
        needsAmount?: boolean;
        needsRecipient?: boolean;
        needsChain?: boolean;
        needsCurrency?: boolean;
    };
    suggestedValues?: {
        amount?: string;
        recipient?: string;
        chainName?: string;
        currency?: string;
    };
    conversationalResponse?: string;
}

export interface TransferValidation {
    isValid: boolean;
    error?: string;
    balance?: string;
    requiredAmount?: string;
}

export class WalletTransferService {
    
    // Word to number mapping for natural language processing
    static readonly WORD_TO_NUMBER: { [key: string]: string } = {
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
        'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
        'eleven': '11', 'twelve': '12', 'thirteen': '13', 'fourteen': '14', 'fifteen': '15',
        'sixteen': '16', 'seventeen': '17', 'eighteen': '18', 'nineteen': '19', 'twenty': '20',
        'thirty': '30', 'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
        'eighty': '80', 'ninety': '90', 'hundred': '100', 'thousand': '1000',
        // Common fractions
        'half': '0.5', 'quarter': '0.25', 'third': '0.33', 'tenth': '0.1'
    };

    static parseTransferCommandEnhanced(command: string): ParsedTransferInfo {
        try {
            console.log(`🎯 Parsing command: "${command}"`);
            
            const normalizedCommand = command.toLowerCase().trim();
            let amount: string = '';
            let recipient: string = '';
            let chainName: string = '';
            let currency: string = '';
            
            const missingInfo = {
                needsAmount: false,
                needsRecipient: false,
                needsChain: false,
                needsCurrency: false
            };
            
            // Word-to-number conversion
            let processedCommand = normalizedCommand;
            for (const [word, number] of Object.entries(this.WORD_TO_NUMBER)) {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                processedCommand = processedCommand.replace(regex, number);
            }
            
            // Define chain mappings
            const chainMappings: { [key: string]: string } = {
                'ethereum': 'ethereum', 'eth': 'ethereum', 'mainnet': 'ethereum',
                'sepolia': 'sepolia', 'testnet': 'sepolia', 'goerli': 'goerli',
                'binance': 'bsc', 'bsc': 'bsc', 'bnb': 'bsc', 'smartchain': 'bsc',
                'base': 'base', 'coinbase': 'base',
                'polygon': 'polygon', 'matic': 'polygon', 'poly': 'polygon',
                'arbitrum': 'arbitrum', 'arb': 'arbitrum',
                'optimism': 'optimism', 'op': 'optimism'
            };
            
            // Define currency mappings
            const currencyMappings: { [key: string]: string } = {
                'eth': 'ETH', 'ethereum': 'ETH', 'ether': 'ETH',
                'bnb': 'BNB', 'binance': 'BNB',
                'matic': 'MATIC', 'polygon': 'MATIC'
            };
            
            // Extract numbers (now includes word-converted ones)
            const numberMatches = processedCommand.match(/\b(\d+(?:\.\d+)?)\b/g);
            console.log(`🔢 Found numbers: ${numberMatches?.join(', ') || 'none'}`);
            
            const words = processedCommand.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 0);
            console.log(`📝 Words: ${words.join(', ')}`);
            
            // Extract amount
            if (numberMatches && numberMatches.length > 0) {
                amount = numberMatches[0];
                console.log(`💰 Found amount: ${amount}`);
            } else {
                missingInfo.needsAmount = true;
                console.log('❌ No amount found');
            }
            
            // Extract chain name
            for (const word of words) {
                if (chainMappings[word]) {
                    chainName = chainMappings[word];
                    console.log(`🔗 Found chain: ${word} → ${chainName}`);
                    break;
                }
            }
            
            // Special pattern: "on [chain]"
            if (!chainName) {
                const onChainMatch = processedCommand.match(/\bon\s+(\w+)/i);
                if (onChainMatch && onChainMatch[1]) {
                    const chainKey = onChainMatch[1].toLowerCase();
                    if (chainMappings[chainKey]) {
                        chainName = chainMappings[chainKey];
                        console.log(`🎯 Found "on chain" pattern: ${onChainMatch[1]} → ${chainName}`);
                    }
                }
            }
            
            if (!chainName) {
                missingInfo.needsChain = true;
                console.log('❌ No chain found');
            }
            
            // Extract currency
            for (const word of words) {
                if (currencyMappings[word]) {
                    currency = currencyMappings[word];
                    console.log(`💱 Found currency: ${word} → ${currency}`);
                    break;
                }
            }
            
            if (!currency) {
                // Default to ETH but mark as needing clarification
                currency = 'ETH';
                missingInfo.needsCurrency = true;
                console.log(`💱 Defaulting to currency: ${currency} (needs confirmation)`);
            }
            
            // Extract recipient
            const potentialNames: string[] = [];
            const excludeWords = [
                'transfer', 'send', 'move', 'to', 'from', 'the', 'a', 'an', 'and', 'or', 'but', 
                'with', 'for', 'at', 'in', 'on', 'by', 'please', 'can', 'you', 'could', 'would', 
                'will', 'i', 'me', 'my', 'we', 'us', 'our', 'hey', 'hi', 'hello', 'want', 'need', 
                'like', 'should', 'must', 'have', 'get', 'make', 'do', 'some', 'any', 'all',
                'much', 'many', 'more', 'less', 'chain', 'network', 'mainnet', 'testnet', 'it'
            ];
            
            for (const word of words) {
                const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
                if (cleanWord.length >= 2 && 
                    !excludeWords.includes(cleanWord) && 
                    !chainMappings[cleanWord] &&
                    !currencyMappings[cleanWord] &&
                    !/^\d/.test(cleanWord) && 
                    cleanWord.length <= 20) {
                    potentialNames.push(cleanWord);
                }
            }
            
            console.log(`👤 Potential names: ${potentialNames.join(', ')}`);
            
            // Look for recipient after "to"
            const toMatch = processedCommand.match(/\bto\s+([a-zA-Z]+)/i);
            if (toMatch && toMatch[1]) {
                const nameAfterTo = toMatch[1].toLowerCase().replace(/[^\w]/g, '');
                recipient = `${nameAfterTo}.eth`;
                console.log(`🎯 Found name after "to": ${nameAfterTo} → ${recipient}`);
            } else if (potentialNames.length > 0) {
                // Pick the best candidate name
                const commonNames = ['alex', 'alice', 'bob', 'charlie', 'david', 'emma', 'frank', 
                                   'grace', 'henry', 'ivy', 'jack', 'kate', 'liam', 'mia', 'noah', 
                                   'olivia', 'peter', 'quinn', 'ryan', 'sara', 'vitalik', 'satoshi', 
                                   'nick', 'joe', 'max', 'sam', 'tom', 'ben', 'dan', 'tim', 'bhargav'];
                
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
            
            // Look for Ethereum address
            if (!recipient) {
                const addressMatch = processedCommand.match(/(0x[a-fA-F0-9]{40})/i);
                if (addressMatch && addressMatch[1]) {
                    recipient = addressMatch[1].toLowerCase();
                    console.log(`📍 Found Ethereum address: ${recipient}`);
                }
            }
            
            if (!recipient) {
                missingInfo.needsRecipient = true;
                console.log('❌ No recipient found');
            }
            
            // Generate conversational response based on what's missing
            let conversationalResponse = '';
            const missing = [];
            if (missingInfo.needsAmount) missing.push('amount');
            if (missingInfo.needsRecipient) missing.push('recipient');
            if (missingInfo.needsChain) missing.push('blockchain network');
            
            if (missing.length > 0) {
                if (missing.length === 1) {
                    if (missingInfo.needsAmount) {
                        conversationalResponse = `I understand you want to transfer to ${recipient || 'someone'}, but I need to know how much. Could you tell me the amount? For example, "1 ETH" or "0.5 ETH"?`;
                    } else if (missingInfo.needsRecipient) {
                        conversationalResponse = `I see you want to transfer ${amount} ${currency}, but I need to know who to send it to. Could you provide the recipient's name or ENS address?`;
                    } else if (missingInfo.needsChain) {
                        conversationalResponse = `Great! I understand you want to send ${amount} ${currency} to ${recipient}. Which blockchain network would you like to use? I support Ethereum, Base, Polygon, Arbitrum, and others.`;
                    }
                } else {
                    conversationalResponse = `I'd be happy to help with the transfer! However, I need a bit more information. Please specify: ${missing.join(', ')}. For example, you could say "transfer 1 ETH to alice on ethereum".`;
                }
            }
            
            // If we have everything, create the complete request
            if (!missingInfo.needsAmount && !missingInfo.needsRecipient && !missingInfo.needsChain) {
                const request: TransferRequest = {
                    amount,
                    recipient,
                    chainName,
                    currency,
                    fromWalletIndex: 0
                };
                
                console.log(`✅ Complete transfer request:`, request);
                return { 
                    request,
                    conversationalResponse: `Perfect! I understand you want to transfer ${amount} ${currency} to ${recipient} on ${chainName}. Let me process that for you.`
                };
            }
            
            // Return partial info with what we found
            const suggestedValues: { amount?: string; recipient?: string; chainName?: string; currency?: string; } = {};
            if (amount) suggestedValues.amount = amount;
            if (recipient) suggestedValues.recipient = recipient;
            if (chainName) suggestedValues.chainName = chainName;
            else suggestedValues.chainName = 'ethereum'; // Default suggestion
            if (currency) suggestedValues.currency = currency;
            else suggestedValues.currency = 'ETH';
            
            return {
                missingInfo,
                suggestedValues,
                conversationalResponse
            };
            
        } catch (error) {
            console.error('Error parsing transfer command:', error);
            return {
                conversationalResponse: "I'm sorry, I had trouble understanding that. Could you please rephrase your transfer request? Try something like 'transfer 1 ETH to alice on ethereum'."
            };
        }
    }

    static parseTransferCommand(command: string): TransferRequest | null {
        const result = this.parseTransferCommandEnhanced(command);
        return result.request || null;
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

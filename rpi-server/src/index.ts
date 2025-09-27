import express, { type Request, type Response } from "express";
import { gptService, type ActionableResponse } from "./gpt/service.js";
import { PhysicalWalletService } from "./services/physicalWallet.js";
import { WalletQueryService } from "./services/walletQueryService.js";
import VoiceCommandRouter from "./services/voiceCommandRouter.js";
import { uiSyncService } from "./services/uiSyncService.js";
import { conversationManager } from "./services/conversationManager.js";
import { speakText } from "./output/speak.js";
import { GraphProtocolService, type TokenBalance, type WalletData, WalletMonitorService, type WalletMonitor } from "./graph/market/walletmonitor.ts";

const app = express();
const port = 3000;

// Initialize Services
const physicalWalletService = new PhysicalWalletService();
const graphProtocolService = new GraphProtocolService();
const walletMonitorService = new WalletMonitorService();
const walletQueryService = new WalletQueryService(physicalWalletService);
const voiceCommandRouter = new VoiceCommandRouter(physicalWalletService, walletQueryService);

// Middleware to parse JSON
app.use(express.json());

// Interface for the GPT request body
interface GPTRequestBody {
    text: string;
    sessionId?: string;
    continueSession?: boolean;
}

// Interface for wallet import requests
interface ImportWalletRequest {
    privateKey?: string;
    mnemonic?: string;
}

// Interface for monitoring requests
interface MonitoringRequest {
    address: string;
    intervalMs?: number;
}

// Physical Wallet Routes

// Generate new wallet
app.post("/wallet/generate", async (req: Request, res: Response) => {
    try {
        const physicalWallet = await physicalWalletService.generatePhysicalWallet();
        const totalWalletCount = physicalWalletService.getWalletCount();
        
        res.json({
            success: true,
            message: "Physical wallet generated successfully",
            wallet: {
                address: physicalWallet.walletInfo.address,
                publicKey: physicalWallet.walletInfo.publicKey,
                // Note: In production, never send private keys over the network
                // This is for development/demo purposes only
                privateKey: physicalWallet.walletInfo.privateKey,
                mnemonic: physicalWallet.walletInfo.mnemonic,
                createdAt: physicalWallet.createdAt,
                walletData: physicalWallet.walletData
            },
            totalWalletCount: totalWalletCount,
            message_detail: `New wallet created. You now have ${totalWalletCount} wallet${totalWalletCount === 1 ? '' : 's'} in total.`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error generating wallet:", error);
        res.status(500).json({
            success: false,
            error: "Failed to generate wallet",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Import wallet from private key or mnemonic
app.post("/wallet/import", async (req: Request, res: Response) => {
    try {
        const { privateKey, mnemonic }: ImportWalletRequest = req.body;
        
        if (!privateKey && !mnemonic) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Either privateKey or mnemonic must be provided"
            });
        }
        
        let physicalWallet;
        if (privateKey) {
            physicalWallet = await physicalWalletService.importWalletFromPrivateKey(privateKey);
        } else if (mnemonic) {
            physicalWallet = await physicalWalletService.importWalletFromMnemonic(mnemonic);
        }
        
        if (!physicalWallet) {
            throw new Error("Failed to import wallet");
        }
        
        const totalWalletCount = physicalWalletService.getWalletCount();
        
        res.json({
            success: true,
            message: "Wallet imported successfully",
            wallet: {
                address: physicalWallet.walletInfo.address,
                publicKey: physicalWallet.walletInfo.publicKey,
                createdAt: physicalWallet.createdAt,
                walletData: physicalWallet.walletData
            },
            totalWalletCount: totalWalletCount,
            message_detail: `Wallet imported successfully. You now have ${totalWalletCount} wallet${totalWalletCount === 1 ? '' : 's'} in total.`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error importing wallet:", error);
        res.status(500).json({
            success: false,
            error: "Failed to import wallet",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Check if wallet exists in storage
app.get("/wallet/storage/check", async (req: Request, res: Response) => {
    try {
        const hasWallet = physicalWalletService.hasStoredWallet();
        const storagePath = physicalWalletService.getWalletStoragePath();
        const walletCount = physicalWalletService.getWalletCount();
        
        if (hasWallet) {
            // Try to load wallet info (address only for security)
            const walletAddress = physicalWalletService.getStoredWalletAddress() || "Unknown";
            res.json({
                success: true,
                hasWallet: true,
                walletAddress,
                walletCount,
                storagePath,
                message: `${walletCount} wallet${walletCount === 1 ? '' : 's'} found in storage`,
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({
                success: true,
                hasWallet: false,
                walletCount: 0,
                storagePath,
                message: "No wallets found in storage",
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error("Error checking wallet storage:", error);
        res.status(500).json({
            success: false,
            error: "Failed to check wallet storage",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// List all wallets in storage
app.get("/wallet/list", async (req: Request, res: Response) => {
    try {
        const walletSummary = physicalWalletService.getWalletSummary();
        const allWallets = physicalWalletService.getAllStoredWallets();
        
        // Return wallet info without sensitive data (private keys, mnemonics)
        const safeWalletInfo = allWallets.map((wallet, index) => ({
            index: index + 1,
            address: wallet.walletInfo.address,
            publicKey: wallet.walletInfo.publicKey,
            label: wallet.metadata?.label || `Wallet ${index + 1}`,
            notes: wallet.metadata?.notes || '',
            createdAt: wallet.createdAt,
            lastUsed: wallet.lastUsed
        }));

        res.json({
            success: true,
            message: `Found ${walletSummary.count} wallet${walletSummary.count === 1 ? '' : 's'}`,
            totalCount: walletSummary.count,
            wallets: safeWalletInfo,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error listing wallets:", error);
        res.status(500).json({
            success: false,
            error: "Failed to list wallets",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Transfer ETH endpoint (legacy - maintains backward compatibility)
interface TransferRequest {
    toAddress: string;
    amount: string;
    fromAddress?: string; // Optional, will use main wallet if not provided
    voiceFeedback?: boolean; // Optional, enables voice announcements
}

app.post("/wallet/transfer", async (req: Request, res: Response) => {
    try {
        const { toAddress, amount, fromAddress, voiceFeedback }: TransferRequest = req.body;
        
        if (!toAddress || !amount) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "toAddress and amount are required"
            });
        }
        
        let transferResult;
        if (fromAddress) {
            transferResult = await physicalWalletService.transferETH(fromAddress, toAddress, amount);
        } else {
            // Use main wallet from storage
            transferResult = await physicalWalletService.transferFromMainWallet(toAddress, amount);
        }
        
        // Optional voice feedback
        if (voiceFeedback) {
            if (transferResult.success && transferResult.transactionHash) {
                speakText(`Transfer successful! Transaction hash ${transferResult.transactionHash.slice(0, 8)}...${transferResult.transactionHash.slice(-6)} completed.`);
            } else {
                speakText(`Transfer failed. ${transferResult.error || 'Please check your transaction details.'}`);
            }
        }
        
        if (transferResult.success) {
            res.json({
                success: true,
                message: "Transfer completed successfully",
                transfer: transferResult,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(400).json({
                success: false,
                error: "Transfer failed",
                message: transferResult.error,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error("Error processing transfer:", error);
        res.status(500).json({
            success: false,
            error: "Failed to process transfer",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Voice-activated transfer endpoint
app.post("/wallet/transfer/voice", async (req: Request, res: Response) => {
    try {
        const { toAddress, amount, rpcUrl }: { toAddress: string; amount: string; rpcUrl?: string } = req.body;
        
        if (!toAddress || !amount) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "toAddress and amount are required"
            });
        }
        
        console.log(`🎤 Voice-activated transfer requested: ${amount} ETH to ${toAddress}`);
        
        // Use our new transfer command processing with natural language-like input
        const commandText = `transfer ${amount} ETH to ${toAddress}`;
        const transferResponse = await physicalWalletService.processTransferCommand(commandText);
        
        if (transferResponse.success) {
            res.json({
                success: true,
                message: transferResponse.spokenMessage,
                transfer: transferResponse,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(400).json({
                success: false,
                error: transferResponse.error || "Transfer failed",
                message: transferResponse.spokenMessage,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error("Error in voice transfer:", error);
        res.status(500).json({
            success: false,
            error: "Failed to process voice transfer",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Get wallet summary for transfer operations
app.get("/wallet/transfer/summary", async (req: Request, res: Response) => {
    try {
        const walletCount = physicalWalletService.getWalletCount();
        const allWallets = physicalWalletService.getAllStoredWallets();
        
        // Get basic summary information
        const summary = {
            totalWallets: walletCount,
            hasMainWallet: walletCount > 0,
            mainWalletAddress: walletCount > 0 ? allWallets[0]?.walletInfo.address : null
        };
        
        res.json({
            success: true,
            summary,
            walletCount,
            hasWallets: walletCount > 0,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error getting transfer summary:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get transfer summary",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Create wallet for transfer (when no wallets exist)
app.post("/wallet/transfer/create", async (req: Request, res: Response) => {
    try {
        const physicalWallet = await physicalWalletService.generatePhysicalWallet();
        
        res.json({
            success: true,
            message: "Wallet created successfully for transfers",
            walletAddress: physicalWallet.walletInfo.address,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error creating wallet for transfer:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create wallet",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Get wallet data
app.get("/wallet/:address", async (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address is required"
            });
        }
        
        const wallet = physicalWalletService.getWallet(address);
        if (!wallet) {
            return res.status(404).json({
                success: false,
                error: "Not Found",
                message: "Wallet not found"
            });
        }
        
        res.json({
            success: true,
            wallet: {
                address: wallet.walletInfo.address,
                publicKey: wallet.walletInfo.publicKey,
                isMonitoring: wallet.isMonitoring,
                createdAt: wallet.createdAt,
                lastUpdated: wallet.lastUpdated,
                walletData: wallet.walletData
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error getting wallet:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get wallet",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Update wallet data
app.post("/wallet/:address/update", async (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address is required"
            });
        }
        
        const updatedData = await physicalWalletService.updateWalletData(address);
        
        res.json({
            success: true,
            message: "Wallet data updated successfully",
            walletData: updatedData,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error updating wallet data:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update wallet data",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Get wallet transactions
app.get("/wallet/:address/transactions", async (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address is required"
            });
        }
        
        const limit = parseInt(req.query.limit as string) || 10;
        
        const transactions = await physicalWalletService.getWalletTransactions(address, limit);
        
        res.json({
            success: true,
            address,
            transactions: transactions.map(tx => ({
                id: tx.transaction_id,
                timestamp: new Date(tx.timestamp * 1000).toISOString(),
                from: tx.from,
                to: tx.to,
                value: tx.value,
                symbol: tx.symbol,
                decimals: tx.decimals
            })),
            count: transactions.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error getting wallet transactions:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get wallet transactions",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Start monitoring wallet
app.post("/wallet/:address/monitor", async (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address is required"
            });
        }
        
        const { intervalMs }: MonitoringRequest = req.body;
        
        await physicalWalletService.startWalletMonitoring(address, intervalMs || 30000);
        
        res.json({
            success: true,
            message: `Started monitoring wallet ${address}`,
            address,
            intervalMs: intervalMs || 30000,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error starting wallet monitoring:", error);
        res.status(500).json({
            success: false,
            error: "Failed to start wallet monitoring",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Stop monitoring wallet
app.post("/wallet/:address/stop-monitor", (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address is required"
            });
        }
        
        physicalWalletService.stopWalletMonitoring(address);
        
        res.json({
            success: true,
            message: `Stopped monitoring wallet ${address}`,
            address,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error stopping wallet monitoring:", error);
        res.status(500).json({
            success: false,
            error: "Failed to stop wallet monitoring",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Get all wallets
app.get("/wallets", (req: Request, res: Response) => {
    try {
        const wallets = physicalWalletService.getAllWallets();
        
        res.json({
            success: true,
            wallets: wallets.map(wallet => ({
                address: wallet.walletInfo.address,
                publicKey: wallet.walletInfo.publicKey,
                isMonitoring: wallet.isMonitoring,
                createdAt: wallet.createdAt,
                lastUpdated: wallet.lastUpdated,
                tokenCount: wallet.walletData?.tokenBalances?.length || 0,
                transactionCount: wallet.walletData?.transactionCount || 0
            })),
            count: wallets.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error getting all wallets:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get wallets",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Get specific token/coin data for a wallet
app.get("/wallet/:address/token/:tokenSymbol", async (req: Request, res: Response) => {
    try {
        const { address, tokenSymbol } = req.params;
        const { networkId } = req.query;
        
        if (!address || !tokenSymbol) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address and token symbol are required"
            });
        }
        
        // Get wallet data including all token balances
        const walletData = await graphProtocolService.getWalletData(
            address, 
            (networkId as string) || 'mainnet'
        );
        
        // Filter for the specific token/coin
        const tokenBalance = walletData.tokenBalances.find(token => 
            token.symbol.toLowerCase() === tokenSymbol.toLowerCase() ||
            token.name.toLowerCase() === tokenSymbol.toLowerCase() ||
            token.contract.toLowerCase() === tokenSymbol.toLowerCase()
        );
        
        if (!tokenBalance) {
            return res.status(404).json({
                success: false,
                error: "Token not found",
                message: `Token '${tokenSymbol}' not found in wallet ${address}`,
                availableTokens: walletData.tokenBalances.map(token => ({
                    symbol: token.symbol,
                    name: token.name,
                    contract: token.contract
                })),
                timestamp: new Date().toISOString()
            });
        }
        
        // Calculate percentage of total portfolio value
        const portfolioPercentage = walletData.totalValueUSD > 0 
            ? ((tokenBalance.value / walletData.totalValueUSD) * 100).toFixed(2)
            : "0.00";
        
        res.json({
            success: true,
            walletAddress: address,
            tokenInfo: {
                symbol: tokenBalance.symbol,
                name: tokenBalance.name,
                contract: tokenBalance.contract,
                balance: tokenBalance.amount,
                decimals: tokenBalance.decimals,
                valueUSD: tokenBalance.value,
                portfolioPercentage: `${portfolioPercentage}%`,
                lastUpdate: tokenBalance.last_balance_update,
                blockNumber: tokenBalance.block_num,
                networkId: tokenBalance.network_id
            },
            portfolioSummary: {
                totalValueUSD: walletData.totalValueUSD,
                totalTokens: walletData.tokenBalances.length
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Error getting token data:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get token data",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Get all tokens for a wallet with filtering options
app.get("/wallet/:address/tokens", async (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        const { networkId, minValue, symbol } = req.query;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address is required"
            });
        }
        
        // Get wallet data including all token balances
        const walletData = await graphProtocolService.getWalletData(
            address, 
            (networkId as string) || 'mainnet'
        );
        
        let filteredTokens = walletData.tokenBalances;
        
        // Apply filters
        if (minValue) {
            const minVal = parseFloat(minValue as string);
            filteredTokens = filteredTokens.filter(token => token.value >= minVal);
        }
        
        if (symbol) {
            const searchSymbol = (symbol as string).toLowerCase();
            filteredTokens = filteredTokens.filter(token => 
                token.symbol.toLowerCase().includes(searchSymbol) ||
                token.name.toLowerCase().includes(searchSymbol)
            );
        }
        
        // Sort by value (descending)
        filteredTokens.sort((a, b) => b.value - a.value);
        
        // Calculate portfolio percentages
        const tokensWithPercentage = filteredTokens.map(token => ({
            symbol: token.symbol,
            name: token.name,
            contract: token.contract,
            balance: token.amount,
            decimals: token.decimals,
            valueUSD: token.value,
            portfolioPercentage: walletData.totalValueUSD > 0 
                ? `${((token.value / walletData.totalValueUSD) * 100).toFixed(2)}%`
                : "0.00%",
            lastUpdate: token.last_balance_update,
            blockNumber: token.block_num,
            networkId: token.network_id
        }));
        
        res.json({
            success: true,
            walletAddress: address,
            filters: {
                networkId: (networkId as string) || 'mainnet',
                minValue: minValue ? parseFloat(minValue as string) : undefined,
                symbolFilter: symbol as string
            },
            tokens: tokensWithPercentage,
            summary: {
                totalTokens: filteredTokens.length,
                totalValueUSD: filteredTokens.reduce((sum, token) => sum + token.value, 0),
                portfolioTotalValueUSD: walletData.totalValueUSD
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Error getting wallet tokens:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get wallet tokens",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// ===== COMPREHENSIVE WALLET MONITOR ENDPOINTS =====

// Initialize wallet monitoring service
app.post("/monitor/initialize", async (req: Request, res: Response) => {
    try {
        await walletMonitorService.initialize();
        res.json({
            success: true,
            message: "Wallet monitoring service initialized successfully",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error initializing wallet monitor service:", error);
        res.status(500).json({
            success: false,
            error: "Failed to initialize wallet monitor service",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Add wallet to monitoring service
app.post("/monitor/wallet/add", async (req: Request, res: Response) => {
    try {
        const { address, publicKey, privateKey, mnemonic } = req.body;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address is required"
            });
        }

        const walletInfo = {
            address,
            publicKey: publicKey || "",
            privateKey: privateKey || "",
            mnemonic: mnemonic || ""
        };

        const walletMonitor = await walletMonitorService.addWalletToMonitor(walletInfo);
        
        res.json({
            success: true,
            message: `Wallet ${address} added to monitoring service`,
            walletMonitor: {
                address: walletMonitor.walletInfo.address,
                isMonitoring: walletMonitor.isMonitoring,
                lastUpdated: walletMonitor.lastUpdated,
                walletData: walletMonitor.walletData
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error adding wallet to monitor:", error);
        res.status(500).json({
            success: false,
            error: "Failed to add wallet to monitor",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Start comprehensive wallet monitoring
app.post("/monitor/wallet/:address/start", async (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        const { intervalMs } = req.body;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address is required"
            });
        }

        await walletMonitorService.startMonitoring(address, intervalMs || 30000);
        
        res.json({
            success: true,
            message: `Started comprehensive monitoring for wallet ${address}`,
            address,
            intervalMs: intervalMs || 30000,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error starting wallet monitoring:", error);
        res.status(500).json({
            success: false,
            error: "Failed to start wallet monitoring",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Stop wallet monitoring
app.post("/monitor/wallet/:address/stop", (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address is required"
            });
        }

        walletMonitorService.stopMonitoring(address);
        
        res.json({
            success: true,
            message: `Stopped monitoring wallet ${address}`,
            address,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error stopping wallet monitoring:", error);
        res.status(500).json({
            success: false,
            error: "Failed to stop wallet monitoring",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Get comprehensive wallet monitor data
app.get("/monitor/wallet/:address", (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address is required"
            });
        }

        const walletMonitor = walletMonitorService.getWalletMonitor(address);
        
        if (!walletMonitor) {
            return res.status(404).json({
                success: false,
                error: "Not Found",
                message: `Wallet ${address} not found in monitoring service`
            });
        }

        res.json({
            success: true,
            walletMonitor: {
                address: walletMonitor.walletInfo.address,
                isMonitoring: walletMonitor.isMonitoring,
                lastUpdated: walletMonitor.lastUpdated,
                walletData: walletMonitor.walletData
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error getting wallet monitor:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get wallet monitor",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Get all monitored wallets
app.get("/monitor/wallets", (req: Request, res: Response) => {
    try {
        const monitoredWallets = walletMonitorService.getAllMonitoredWallets();
        
        res.json({
            success: true,
            monitoredWallets: monitoredWallets.map(wallet => ({
                address: wallet.walletInfo.address,
                isMonitoring: wallet.isMonitoring,
                lastUpdated: wallet.lastUpdated,
                tokenCount: wallet.walletData?.tokenBalances?.length || 0,
                totalValueUSD: wallet.walletData?.totalValueUSD || 0,
                transactionCount: wallet.walletData?.transactionCount || 0
            })),
            count: monitoredWallets.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error getting monitored wallets:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get monitored wallets",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Update wallet data manually
app.post("/monitor/wallet/:address/update", async (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address is required"
            });
        }

        const updatedData = await walletMonitorService.updateWalletData(address);
        
        res.json({
            success: true,
            message: `Wallet data updated for ${address}`,
            address,
            walletData: updatedData,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error updating wallet data:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update wallet data",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Get wallet transactions from monitoring service
app.get("/monitor/wallet/:address/transactions", async (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        const limit = parseInt(req.query.limit as string) || 10;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address is required"
            });
        }

        const transactions = await walletMonitorService.getWalletTransactions(address, limit);
        
        res.json({
            success: true,
            address,
            transactions: transactions.map(tx => ({
                id: tx.transaction_id,
                timestamp: new Date(tx.timestamp * 1000).toISOString(),
                datetime: tx.datetime,
                from: tx.from,
                to: tx.to,
                value: tx.value,
                symbol: tx.symbol,
                decimals: tx.decimals,
                contract: tx.contract,
                blockNumber: tx.block_num
            })),
            count: transactions.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error getting wallet transactions:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get wallet transactions",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Remove wallet from monitoring
app.delete("/monitor/wallet/:address", (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address is required"
            });
        }

        const removed = walletMonitorService.removeWallet(address);
        
        if (removed) {
            res.json({
                success: true,
                message: `Wallet ${address} removed from monitoring service`,
                address,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(404).json({
                success: false,
                error: "Not Found",
                message: `Wallet ${address} not found in monitoring service`
            });
        }
    } catch (error) {
        console.error("Error removing wallet from monitoring:", error);
        res.status(500).json({
            success: false,
            error: "Failed to remove wallet from monitoring",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// ===== WALLET QUERY SERVICE ENDPOINTS =====

// Quick wallet balance endpoint
app.get("/query/balance", async (req: Request, res: Response) => {
    try {
        const result = await walletQueryService.getWalletBalance();
        res.json({
            success: result.success,
            message: result.message,
            data: result.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Failed to get balance",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Quick token price endpoint
app.get("/query/token/:symbol/price", async (req: Request, res: Response) => {
    try {
        const { symbol } = req.params;
        if (!symbol) {
            return res.status(400).json({
                success: false,
                error: "Token symbol is required"
            });
        }
        const result = await walletQueryService.getTokenPrice(symbol);
        res.json({
            success: result.success,
            message: result.message,
            data: result.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Failed to get token price",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Quick portfolio value endpoint
app.get("/query/portfolio", async (req: Request, res: Response) => {
    try {
        const result = await walletQueryService.getPortfolioValue();
        res.json({
            success: result.success,
            message: result.message,
            data: result.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Failed to get portfolio value",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Quick wallet summary endpoint
app.get("/query/summary", async (req: Request, res: Response) => {
    try {
        const result = await walletQueryService.getWalletSummary();
        res.json({
            success: result.success,
            message: result.message,
            data: result.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Failed to get wallet summary",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Token holdings with filters
app.get("/query/holdings", async (req: Request, res: Response) => {
    try {
        const { minValue, symbol } = req.query;
        const params: any = {};
        
        if (minValue && !isNaN(parseFloat(minValue as string))) {
            params.minValue = parseFloat(minValue as string);
        }
        if (symbol) {
            params.symbol = symbol as string;
        }
        
        const result = await walletQueryService.getTokenHoldings(params);
        res.json({
            success: result.success,
            message: result.message,
            data: result.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Failed to get token holdings",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Market insights endpoint
app.get("/query/insights", async (req: Request, res: Response) => {
    try {
        const result = await walletQueryService.getMarketInsights();
        res.json({
            success: result.success,
            message: result.message,
            data: result.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Failed to get market insights",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Search tokens endpoint
app.get("/query/search/:term", async (req: Request, res: Response) => {
    try {
        const { term } = req.params;
        if (!term) {
            return res.status(400).json({
                success: false,
                error: "Search term is required"
            });
        }
        const result = await walletQueryService.searchTokens(term);
        res.json({
            success: result.success,
            message: result.message,
            data: result.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Failed to search tokens",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Wallet activity endpoint
app.get("/query/activity", async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const result = await walletQueryService.getWalletActivity(limit);
        res.json({
            success: result.success,
            message: result.message,
            data: result.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Failed to get wallet activity",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Filtered wallet activity endpoint
app.get("/query/activity/:filter", async (req: Request, res: Response) => {
    try {
        const { filter } = req.params;
        const limit = parseInt(req.query.limit as string) || 10;
        
        if (!filter) {
            return res.status(400).json({
                success: false,
                error: "Filter type is required (incoming/outgoing/recent/token_symbol)"
            });
        }
        
        const result = await walletQueryService.getFilteredWalletActivity(filter, limit);
        res.json({
            success: result.success,
            message: result.message,
            data: result.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Failed to get filtered wallet activity",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});


app.get("/market/wallet/:address/coin/:coinSymbol", async (req: Request, res: Response) => {
    try {
        const { address, coinSymbol } = req.params;
        const { networkId } = req.query;
        
        if (!address || !coinSymbol) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address and coin symbol are required"
            });
        }
        
        // Get wallet data including all token balances
        const walletData = await graphProtocolService.getWalletData(
            address, 
            (networkId as string) || 'mainnet'
        );
        
        // Filter for the specific coin/token (more comprehensive matching)
        const coinBalance = walletData.tokenBalances.find(token => 
            token.symbol.toLowerCase() === coinSymbol.toLowerCase() ||
            token.name.toLowerCase().includes(coinSymbol.toLowerCase()) ||
            token.contract.toLowerCase() === coinSymbol.toLowerCase()
        );
        
        if (!coinBalance) {
            return res.status(404).json({
                success: false,
                error: "Coin not found",
                message: `Coin '${coinSymbol}' not found in wallet ${address}`,
                availableCoins: walletData.tokenBalances.map(token => ({
                    symbol: token.symbol,
                    name: token.name,
                    contract: token.contract,
                    value: token.value
                })),
                timestamp: new Date().toISOString()
            });
        }
        
        // Calculate additional market metrics
        const portfolioPercentage = walletData.totalValueUSD > 0 
            ? ((coinBalance.value / walletData.totalValueUSD) * 100).toFixed(2)
            : "0.00";
            
        const marketData = {
            coinInfo: {
                symbol: coinBalance.symbol,
                name: coinBalance.name,
                contract: coinBalance.contract,
                networkId: coinBalance.network_id
            },
            balance: {
                raw: coinBalance.amount,
                formatted: `${coinBalance.amount} ${coinBalance.symbol}`,
                decimals: coinBalance.decimals
            },
            marketValue: {
                usd: coinBalance.value,
                portfolioPercentage: `${portfolioPercentage}%`,
                lastUpdate: coinBalance.last_balance_update,
                blockNumber: coinBalance.block_num
            },
            walletContext: {
                walletAddress: address,
                totalPortfolioValueUSD: walletData.totalValueUSD,
                totalTokensInWallet: walletData.tokenBalances.length,
                rank: walletData.tokenBalances
                    .sort((a, b) => b.value - a.value)
                    .findIndex(token => token.symbol === coinBalance.symbol) + 1
            }
        };
        
        res.json({
            success: true,
            coinSymbol: coinSymbol.toUpperCase(),
            marketData,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Error getting coin market data:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get coin market data",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Get top coins by value in a wallet
app.get("/market/wallet/:address/top-coins", async (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        const { limit, networkId, minValue } = req.query;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address is required"
            });
        }
        
        const walletData = await graphProtocolService.getWalletData(
            address, 
            (networkId as string) || 'mainnet'
        );
        
        let filteredTokens = walletData.tokenBalances;
        
        // Apply minimum value filter
        if (minValue) {
            const minVal = parseFloat(minValue as string);
            filteredTokens = filteredTokens.filter(token => token.value >= minVal);
        }
        
        // Sort by value (descending) and limit
        filteredTokens.sort((a, b) => b.value - a.value);
        const topLimit = parseInt(limit as string) || 10;
        const topCoins = filteredTokens.slice(0, topLimit);
        
        // Calculate additional metrics for each coin
        const enrichedCoins = topCoins.map((coin, index) => ({
            rank: index + 1,
            coinInfo: {
                symbol: coin.symbol,
                name: coin.name,
                contract: coin.contract
            },
            balance: {
                raw: coin.amount,
                formatted: `${coin.amount} ${coin.symbol}`,
                decimals: coin.decimals
            },
            marketValue: {
                usd: coin.value,
                portfolioPercentage: `${((coin.value / walletData.totalValueUSD) * 100).toFixed(2)}%`,
                lastUpdate: coin.last_balance_update,
                blockNumber: coin.block_num
            }
        }));
        
        res.json({
            success: true,
            walletAddress: address,
            filters: {
                networkId: (networkId as string) || 'mainnet',
                limit: topLimit,
                minValue: minValue ? parseFloat(minValue as string) : undefined
            },
            topCoins: enrichedCoins,
            summary: {
                totalCoinsShown: enrichedCoins.length,
                totalValueShown: enrichedCoins.reduce((sum, coin) => sum + coin.marketValue.usd, 0),
                totalPortfolioValue: walletData.totalValueUSD,
                totalCoinsInWallet: walletData.tokenBalances.length
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Error getting top coins:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get top coins",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Get market summary for a wallet
app.get("/market/wallet/:address/summary", async (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        const { networkId } = req.query;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Bad Request",
                message: "Wallet address is required"
            });
        }
        
        const walletData = await graphProtocolService.getWalletData(
            address, 
            (networkId as string) || 'mainnet'
        );
        
        // Calculate market metrics
        const sortedTokens = walletData.tokenBalances.sort((a, b) => b.value - a.value);
        const topToken = sortedTokens[0];
        const tokensWithValue = sortedTokens.filter(token => token.value > 0);
        const tokensWithoutValue = sortedTokens.filter(token => token.value === 0);
        
        // Calculate diversification metrics
        const totalValue = walletData.totalValueUSD;
        const concentration = topToken && totalValue > 0 ? (topToken.value / totalValue) * 100 : 0;
        
        const marketSummary = {
            portfolio: {
                totalValueUSD: totalValue,
                totalTokens: walletData.tokenBalances.length,
                tokensWithValue: tokensWithValue.length,
                tokensWithoutValue: tokensWithoutValue.length,
                lastTransactionCount: walletData.transactionCount
            },
            topHolding: topToken ? {
                symbol: topToken.symbol,
                name: topToken.name,
                value: topToken.value,
                percentage: `${concentration.toFixed(2)}%`
            } : null,
            diversification: {
                concentration: `${concentration.toFixed(2)}%`,
                risk: concentration > 50 ? "High" : concentration > 25 ? "Medium" : "Low"
            },
            breakdown: tokensWithValue.slice(0, 5).map(token => ({
                symbol: token.symbol,
                value: token.value,
                percentage: `${((token.value / totalValue) * 100).toFixed(2)}%`
            }))
        };
        
        res.json({
            success: true,
            walletAddress: address,
            marketSummary,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Error getting market summary:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get market summary",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

// Enhanced Voice Command Route with Conversation Context
app.post("/", async (req: Request, res: Response) => {
    const { text, sessionId, continueSession } = req.body;

    // Validate text content
    if (typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ 
            error: "Bad Request", 
            message: "Text must be a non-empty string" 
        });
    }

    try {
        const effectiveSessionId = sessionId || 'default';
        
        // Process with enhanced voice command router
        const result = await voiceCommandRouter.processVoiceCommand(text, effectiveSessionId);
        
        // Return enhanced response with conversation context
        return res.json({
            success: result.success,
            user_input: text,
            pluto_response: result.message,
            spoken_response: result.spokenMessage,
            display_message: result.displayMessage,
            data: result.data,
            session_id: result.sessionId,
            continue_listening: result.continueListening ?? true,
            requires_confirmation: result.requiresConfirmation ?? false,
            session_active: conversationManager.isSessionActive(effectiveSessionId),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Error processing voice command:", error);
        const errorMessage = "Sorry, I'm having some technical difficulties. Please try again.";
        
        await uiSyncService.showErrorState(errorMessage);
        speakText(errorMessage);
        
        return res.status(500).json({
            success: false,
            error: "Internal server error",
            message: error instanceof Error ? error.message : "Unknown error",
            continue_listening: true,
            timestamp: new Date().toISOString()
        });
    }
});

// Session Management Endpoints

// Check session status
app.get("/session/:sessionId/status", (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
    }
    
    const isActive = conversationManager.isSessionActive(sessionId);
    const context = conversationManager.getOrCreateContext(sessionId);
    
    res.json({
        success: true,
        sessionId,
        isActive,
        lastInteraction: context.lastInteraction,
        conversationLength: context.conversationHistory.length,
        currentTopic: context.currentTopic,
        awaitingConfirmation: !!context.awaitingConfirmation,
        timestamp: new Date().toISOString()
    });
});

// End session
app.post("/session/:sessionId/end", async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
    }
    
    conversationManager.endSession(sessionId);
    await uiSyncService.clearDisplay();
    
    res.json({
        success: true,
        message: `Session ${sessionId} ended successfully`,
        sessionId,
        timestamp: new Date().toISOString()
    });
});

// Get conversation history
app.get("/session/:sessionId/history", (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
    }
    
    const limit = parseInt(req.query.limit as string) || 20;
    const context = conversationManager.getOrCreateContext(sessionId);
    const history = context.conversationHistory.slice(-limit);
    
    res.json({
        success: true,
        sessionId,
        history,
        totalInteractions: context.conversationHistory.length,
        timestamp: new Date().toISOString()
    });
});

// Update user preferences for session
app.post("/session/:sessionId/preferences", (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const preferences = req.body;
    
    if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
    }
    
    conversationManager.updateUserPreferences(sessionId, preferences);
    
    res.json({
        success: true,
        message: "Preferences updated successfully",
        sessionId,
        preferences,
        timestamp: new Date().toISOString()
    });
});

// Get active sessions count
app.get("/sessions/stats", (req: Request, res: Response) => {
    const activeCount = conversationManager.getActiveSessionCount();
    
    res.json({
        success: true,
        activeSessionCount: activeCount,
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req: Request, res: Response) => {
    res.send('GET request to the homepage - Pluto Blockchain Helper Server with Enhanced Voice Commands');
});

app.post("/echo", (req: Request, res: Response) => {
    res.json({ youSent: req.body });
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

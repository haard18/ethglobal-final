import express, { type Request, type Response } from "express";
import { gptService, type ActionableResponse } from "./gpt/service.js";
import { PhysicalWalletService } from "./services/physicalWallet.js";
import { TransferService } from "./services/transferService.js";
import { speakText } from "./output/speak.js";
import { GraphProtocolService, type TokenBalance, type WalletData, WalletMonitorService, type WalletMonitor } from "./graph/market/walletmonitor.ts";

const app = express();
const port = 3000;

// Initialize Services
// Initialize services
const physicalWalletService = new PhysicalWalletService();
const graphProtocolService = new GraphProtocolService();
const walletMonitorService = new WalletMonitorService();
const transferService = new TransferService(physicalWalletService);

// Middleware to parse JSON
app.use(express.json());

// Interface for the GPT request body
interface GPTRequestBody {
    text: string;
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
        
        const transferResponse = await transferService.performVoiceActivatedTransfer(toAddress, amount, rpcUrl);
        
        if (transferResponse.success) {
            res.json({
                success: true,
                message: transferResponse.message,
                transfer: transferResponse.result,
                walletUsed: transferResponse.walletUsed,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(400).json({
                success: false,
                error: transferResponse.error || "Transfer failed",
                message: transferResponse.message,
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
        const summary = await transferService.getWalletSummaryForTransfer();
        const walletCount = physicalWalletService.getWalletCount();
        
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
        const result = await transferService.createWalletForTransfer();
        
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                walletAddress: result.address,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message,
                message: "Failed to create wallet for transfer",
                timestamp: new Date().toISOString()
            });
        }
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

// ===== MARKET VALUE ENDPOINTS =====

// Get specific coin/token market data for a wallet
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

// Routes
app.post("/", async (req: Request, res: Response) => {
    const { text } = req.body;

    // Validate text content
    if (typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ 
            error: "Bad Request", 
            message: "Text must be a non-empty string" 
        });
    }

    try {
        // Analyze user intent to see if they want to perform a wallet action
        const intentAnalysis = await gptService.analyzeUserIntent(text);
        
        if (intentAnalysis.isAction && intentAnalysis.action) {
            // Handle wallet actions
            switch (intentAnalysis.action) {
                case 'CREATE_WALLET':
                    try {
                        const physicalWallet = await physicalWalletService.generatePhysicalWallet();
                        
                        // Speak the action confirmation instead of sending to speaker
                        speakText(intentAnalysis.textResponse || "Wallet created successfully!");
                        
                        return res.json({
                            success: true,
                            user_input: text,
                            action_performed: 'CREATE_WALLET',
                            pluto_response: intentAnalysis.textResponse,
                            wallet: {
                                address: physicalWallet.walletInfo.address,
                                publicKey: physicalWallet.walletInfo.publicKey,
                                privateKey: physicalWallet.walletInfo.privateKey,
                                mnemonic: physicalWallet.walletInfo.mnemonic,
                                createdAt: physicalWallet.createdAt,
                                walletData: physicalWallet.walletData
                            },
                            timestamp: new Date().toISOString()
                        });
                    } catch (error) {
                        const errorMessage = "Oops! Had some trouble minting your wallet. Let me try that again.";
                        speakText(errorMessage);
                        return res.status(500).json({
                            success: false,
                            error: "Failed to create wallet",
                            message: error instanceof Error ? error.message : "Unknown error"
                        });
                    }
                
                case 'GET_WALLET_INFO':
                    const wallets = physicalWalletService.getAllWallets();
                    
                    let walletSummary: string;
                    let spokenResponse: string;
                    
                    if (wallets.length === 0) {
                        walletSummary = "You don't have any wallets in your portfolio yet.";
                        spokenResponse = "You don't have any wallets in your portfolio yet. Would you like me to create one for you?";
                    } else if (wallets.length === 1) {
                        const wallet = wallets[0];
                        if (wallet && wallet.walletInfo) {
                            const address = wallet.walletInfo.address;
                            walletSummary = `You have 1 wallet in your portfolio. Your wallet address is ${address}`;
                            
                            // Format address for speaking - break it into chunks for easier listening
                            const formattedAddress = address.slice(0, 6) + "..." + address.slice(-6);
                            spokenResponse = `You have one wallet in your portfolio. Your wallet address is ${formattedAddress}. The full address is being displayed for you.`;
                        } else {
                            walletSummary = "You have 1 wallet, but there's an issue accessing its details.";
                            spokenResponse = "You have one wallet, but I'm having trouble accessing its details right now.";
                        }
                    } else {
                        walletSummary = `You have ${wallets.length} wallets in your portfolio.`;
                        spokenResponse = `You have ${wallets.length} wallets in your portfolio. Let me know which one you'd like details for.`;
                    }
                    
                    speakText(spokenResponse);
                    
                    return res.json({
                        success: true,
                        user_input: text,
                        action_performed: 'GET_WALLET_INFO',
                        pluto_response: walletSummary,
                        wallets: wallets.map(wallet => ({
                            address: wallet.walletInfo.address,
                            isMonitoring: wallet.isMonitoring,
                            createdAt: wallet.createdAt,
                            lastUpdated: wallet.lastUpdated
                        })),
                        timestamp: new Date().toISOString()
                    });
                
                case 'TRANSFER_ETH':
                    try {
                        // Extract transfer parameters from intent analysis
                        const { amount, toAddress } = intentAnalysis.parameters || {};
                        
                        if (!amount || !toAddress) {
                            const errorMessage = "I need both an amount and a recipient address or ENS name to make the transfer.";
                            speakText(errorMessage);
                            return res.status(400).json({
                                success: false,
                                error: "Missing transfer parameters",
                                message: errorMessage,
                                timestamp: new Date().toISOString()
                            });
                        }
                        
                        // Perform transfer using main wallet
                        const transferResult = await physicalWalletService.transferFromMainWallet(toAddress, amount);
                        
                        if (transferResult.success) {
                            const successMessage = `Successfully transferred ${amount} ETH to ${toAddress}. Transaction hash: ${transferResult.transactionHash}`;
                            speakText(`Transfer completed! Sent ${amount} ETH successfully.`);
                            
                            return res.json({
                                success: true,
                                user_input: text,
                                action_performed: 'TRANSFER_ETH',
                                pluto_response: successMessage,
                                transfer: transferResult,
                                timestamp: new Date().toISOString()
                            });
                        } else {
                            const errorMessage = `Transfer failed: ${transferResult.error}`;
                            speakText("Transfer failed. Please check your balance and try again.");
                            
                            return res.status(400).json({
                                success: false,
                                error: "Transfer failed",
                                message: errorMessage,
                                timestamp: new Date().toISOString()
                            });
                        }
                    } catch (error) {
                        const errorMessage = "Had trouble processing your transfer. Please try again.";
                        speakText(errorMessage);
                        return res.status(500).json({
                            success: false,
                            error: "Failed to process transfer",
                            message: error instanceof Error ? error.message : "Unknown error"
                        });
                    }
                
                default:
                    // For other actions, provide guidance
                    const guidanceMessage = intentAnalysis.textResponse || "I understand what you want to do, but I need more information to help you.";
                    speakText(guidanceMessage);
                    
                    return res.json({
                        success: true,
                        user_input: text,
                        action_detected: intentAnalysis.action,
                        pluto_response: guidanceMessage,
                        timestamp: new Date().toISOString()
                    });
            }
        } else {
            // Normal GPT response for general conversation
            const plutoResponse = intentAnalysis.textResponse || await gptService.getResponse(text);
            speakText(plutoResponse);
            
            return res.json({
                success: true,
                user_input: text,
                pluto_response: plutoResponse,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error("Error processing request:", error);
        const errorMessage = "Sorry, I'm having some network issues. Please try again.";
        speakText(errorMessage);
        
        return res.status(500).json({
            success: false,
            error: "Internal server error",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
});

app.get('/', (req: Request, res: Response) => {
    res.send('GET request to the homepage - Pluto Blockchain Helper Server');
});

app.post("/echo", (req: Request, res: Response) => {
    res.json({ youSent: req.body });
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

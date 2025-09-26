import express, { type Request, type Response } from "express";
import { gptService, type ActionableResponse } from "./gpt/service.js";
import { PhysicalWalletService } from "./services/physicalWallet.js";
import { speakText } from "./output/speak.js";

const app = express();
const port = 3000;

// Initialize Physical Wallet Service
const physicalWalletService = new PhysicalWalletService();

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

// Transfer ETH endpoint
interface TransferRequest {
    toAddress: string;
    amount: string;
    fromAddress?: string; // Optional, will use main wallet if not provided
}

app.post("/wallet/transfer", async (req: Request, res: Response) => {
    try {
        const { toAddress, amount, fromAddress }: TransferRequest = req.body;
        
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

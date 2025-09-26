import express, { type Request, type Response } from "express";
import { gptService, type ActionableResponse } from "./gpt/service.js";
import { PhysicalWalletService } from "./services/physicalWallet.js";
import { speakText } from "./output/speak.js";

const app = express();
const port = 3000;

// Initialize Physical Wallet Service (you can add Etherscan API key as environment variable)
const physicalWalletService = new PhysicalWalletService(process.env.ETHERSCAN_API_KEY);

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
        
        res.json({
            success: true,
            message: "Wallet imported successfully",
            wallet: {
                address: physicalWallet.walletInfo.address,
                publicKey: physicalWallet.walletInfo.publicKey,
                createdAt: physicalWallet.createdAt,
                walletData: physicalWallet.walletData
            },
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
                id: tx.id,
                timestamp: new Date(parseInt(tx.timestamp) * 1000).toISOString(),
                from: tx.from,
                to: tx.to,
                value: tx.value,
                gasUsed: tx.gasUsed,
                gasPrice: tx.gasPrice
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
                    const walletSummary = `You have ${wallets.length} wallet${wallets.length !== 1 ? 's' : ''} in your portfolio.`;
                    speakText(walletSummary);
                    
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

import { gptService, type ActionableResponse } from '../gpt/service.js';
import { PhysicalWalletService } from './physicalWallet.js';
import { WalletQueryService } from './walletQueryService.js';
import { MarketCommandRouter } from './marketCommandRouter.js';
import { uiSyncService } from './uiSyncService.js';
import { conversationManager, type ConversationContext } from './conversationManager.js';
import { speakText } from '../output/speak.js';

export interface VoiceCommandResponse {
    success: boolean;
    message: string;
    spokenMessage: string;
    displayMessage?: string;
    data?: any;
    requiresConfirmation?: boolean;
    continueListening?: boolean;
    sessionId: string;
}

export class VoiceCommandRouter {
    private physicalWalletService: PhysicalWalletService;
    private walletQueryService: WalletQueryService;
    private marketCommandRouter: MarketCommandRouter;

    constructor(physicalWalletService: PhysicalWalletService, walletQueryService: WalletQueryService) {
        this.physicalWalletService = physicalWalletService;
        this.walletQueryService = walletQueryService;
        this.marketCommandRouter = new MarketCommandRouter();
    }

    /**
     * Process voice command with conversation context
     */
    async processVoiceCommand(
        text: string,
        sessionId: string = 'default'
    ): Promise<VoiceCommandResponse> {
        console.log(`🎤 Processing voice command: "${text}" (Session: ${sessionId})`);
        
        // Update UI to show processing
        await uiSyncService.showProcessingState(text);
        
        const context = conversationManager.getOrCreateContext(sessionId);
        
        try {
            // Check for pending confirmations first
            const pendingConfirmation = conversationManager.getPendingConfirmation(sessionId);
            if (pendingConfirmation) {
                return await this.handleConfirmationResponse(text, sessionId, pendingConfirmation);
            }

            // Check for session control commands
            if (this.isSessionControlCommand(text)) {
                return await this.handleSessionControl(text, sessionId);
            }

            // Check for market-related commands first
            if (MarketCommandRouter.isMarketCommand(text)) {
                return await this.handleMarketCommand(text, sessionId);
            }

            // Enhanced intent analysis with conversation context
            const contextSummary = conversationManager.getContextSummary(sessionId);
            const intentAnalysis = await gptService.analyzeUserIntentWithContext(text, contextSummary);

            // Route to appropriate handler
            const result = await this.routeCommand(intentAnalysis, text, sessionId);
            
            // Add to conversation history
            conversationManager.addInteraction(
                sessionId,
                text,
                result.message,
                intentAnalysis.action,
                intentAnalysis.parameters
            );

            // Update UI with result
            if (result.success) {
                await uiSyncService.showSuccessState(result.displayMessage || result.message);
            } else {
                await uiSyncService.showErrorState(result.displayMessage || result.message);
            }

            // Speak the response
            speakText(result.spokenMessage);

            return result;

        } catch (error) {
            console.error('Error processing voice command:', error);
            const errorMessage = "Sorry, I had trouble processing that command. Could you try again?";
            
            await uiSyncService.showErrorState(errorMessage);
            speakText(errorMessage);
            
            return {
                success: false,
                message: errorMessage,
                spokenMessage: errorMessage,
                continueListening: true,
                sessionId
            };
        }
    }

    /**
     * Route command to appropriate handler based on intent analysis
     */
    private async routeCommand(
        intentAnalysis: ActionableResponse,
        originalText: string,
        sessionId: string
    ): Promise<VoiceCommandResponse> {
        
        if (!intentAnalysis.isAction || !intentAnalysis.action) {
            // Handle conversation
            return await this.handleConversation(intentAnalysis, originalText, sessionId);
        }

        // Set current topic for context
        conversationManager.setCurrentTopic(sessionId, intentAnalysis.action);

        switch (intentAnalysis.action) {
            case 'CREATE_WALLET':
                return await this.handleCreateWallet(sessionId);

            case 'GET_WALLET_INFO':
                return await this.handleGetWalletInfo(sessionId);

            case 'GET_WALLET_BALANCE':
                return await this.handleGetBalance(sessionId);

            case 'GET_TOKEN_PRICE':
                return await this.handleGetTokenPrice(intentAnalysis.parameters, sessionId);

            case 'GET_PORTFOLIO_VALUE':
                return await this.handleGetPortfolio(sessionId);

            case 'GET_TOKEN_HOLDINGS':
                return await this.handleGetTokenHoldings(intentAnalysis.parameters, sessionId);

            case 'GET_WALLET_SUMMARY':
                return await this.handleGetWalletSummary(sessionId);

            case 'GET_WALLET_ACTIVITY':
                return await this.handleGetWalletActivity(intentAnalysis.parameters, sessionId);

            case 'TRANSFER_ETH':
                return await this.handleTransferETH(intentAnalysis.parameters, originalText, sessionId);

            case 'MONITOR_WALLET':
                return await this.handleMonitorWallet(intentAnalysis.parameters, sessionId);

            default:
                return {
                    success: false,
                    message: `I understand you want to ${intentAnalysis.action.toLowerCase().replace(/_/g, ' ')}, but I need more information.`,
                    spokenMessage: `I understand what you want to do, but I need more details. Could you be more specific?`,
                    continueListening: true,
                    sessionId
                };
        }
    }

    /**
     * Handle conversation without specific actions
     */
    private async handleConversation(
        intentAnalysis: ActionableResponse,
        originalText: string,
        sessionId: string
    ): Promise<VoiceCommandResponse> {
        const response = intentAnalysis.textResponse || await gptService.getResponse(originalText);
        
        return {
            success: true,
            message: response,
            spokenMessage: response,
            continueListening: true,
            sessionId
        };
    }

    /**
     * Handle wallet creation
     */
    private async handleCreateWallet(sessionId: string): Promise<VoiceCommandResponse> {
        try {
            await uiSyncService.showWalletCreationState();
            
            const physicalWallet = await this.physicalWalletService.generatePhysicalWallet();
            const totalCount = this.physicalWalletService.getWalletCount();
            
            const shortAddress = `${physicalWallet.walletInfo.address.slice(0, 6)}...${physicalWallet.walletInfo.address.slice(-4)}`;
            const message = `Great! I've created a new wallet for you. Address: ${shortAddress}. You now have ${totalCount} wallet${totalCount === 1 ? '' : 's'} in total.`;
            const spokenMessage = `Perfect! New wallet created successfully. Address ${shortAddress}. You now have ${totalCount} wallet${totalCount === 1 ? '' : 's'} in your portfolio.`;
            
            return {
                success: true,
                message,
                spokenMessage,
                displayMessage: `Wallet Created!\n${shortAddress}`,
                data: {
                    wallet: {
                        address: physicalWallet.walletInfo.address,
                        publicKey: physicalWallet.walletInfo.publicKey
                    },
                    totalCount
                },
                continueListening: true,
                sessionId
            };
        } catch (error) {
            const errorMessage = "I had trouble creating your wallet. Let me try that again for you.";
            return {
                success: false,
                message: errorMessage,
                spokenMessage: errorMessage,
                continueListening: true,
                sessionId
            };
        }
    }

    /**
     * Handle get wallet info
     */
    private async handleGetWalletInfo(sessionId: string): Promise<VoiceCommandResponse> {
        try {
            const wallets = this.physicalWalletService.getAllWallets();
            
            if (wallets.length === 0) {
                const message = "You don't have any wallets yet. Would you like me to create one for you?";
                return {
                    success: true,
                    message,
                    spokenMessage: message,
                    continueListening: true,
                    sessionId
                };
            }

            if (wallets.length === 1) {
                const wallet = wallets[0];
                const shortAddress = `${wallet!.walletInfo.address.slice(0, 6)}...${wallet!.walletInfo.address.slice(-6)}`;
                const message = `You have 1 wallet in your portfolio. Address: ${wallet!.walletInfo.address}`;
                const spokenMessage = `You have one wallet. Address ${shortAddress}. I'm showing the full address on your display.`;
                
                return {
                    success: true,
                    message,
                    spokenMessage,
                    displayMessage: `Wallet:\n${shortAddress}`,
                    data: { wallets: [{ address: wallet!.walletInfo.address }] },
                    continueListening: true,
                    sessionId
                };
            }

            const message = `You have ${wallets.length} wallets in your portfolio.`;
            const spokenMessage = `You have ${wallets.length} wallets in your portfolio. Which one would you like details about?`;
            
            return {
                success: true,
                message,
                spokenMessage,
                displayMessage: `${wallets.length} Wallets`,
                data: { 
                    wallets: wallets.map(w => ({ address: w.walletInfo.address })),
                    count: wallets.length 
                },
                continueListening: true,
                sessionId
            };
        } catch (error) {
            const errorMessage = "I couldn't retrieve your wallet information right now.";
            return {
                success: false,
                message: errorMessage,
                spokenMessage: errorMessage,
                continueListening: true,
                sessionId
            };
        }
    }

    /**
     * Handle get balance
     */
    private async handleGetBalance(sessionId: string): Promise<VoiceCommandResponse> {
        try {
            await uiSyncService.showBalanceState();
            
            const result = await this.walletQueryService.getWalletBalance();
            
            await uiSyncService.showBalanceState(result.data?.ethBalance?.toString());
            
            return {
                success: result.success,
                message: result.message,
                spokenMessage: result.spokenMessage || result.message,
                displayMessage: result.data?.ethBalance ? `Balance: ${result.data.ethBalance} ETH` : "Balance unavailable",
                data: result.data,
                continueListening: true,
                sessionId
            };
        } catch (error) {
            const errorMessage = "I couldn't fetch your balance right now. Please try again.";
            return {
                success: false,
                message: errorMessage,
                spokenMessage: errorMessage,
                continueListening: true,
                sessionId
            };
        }
    }

    /**
     * Handle get token price
     */
    private async handleGetTokenPrice(parameters: any, sessionId: string): Promise<VoiceCommandResponse> {
        try {
            const tokenSymbol = parameters?.tokenSymbol;
            if (!tokenSymbol) {
                const message = "Which token would you like me to check the price for?";
                return {
                    success: false,
                    message,
                    spokenMessage: message,
                    continueListening: true,
                    sessionId
                };
            }

            const result = await this.walletQueryService.getTokenPrice(tokenSymbol);
            
            return {
                success: result.success,
                message: result.message,
                spokenMessage: result.spokenMessage || result.message,
                data: result.data,
                continueListening: true,
                sessionId
            };
        } catch (error) {
            const errorMessage = "I couldn't fetch the token price right now.";
            return {
                success: false,
                message: errorMessage,
                spokenMessage: errorMessage,
                continueListening: true,
                sessionId
            };
        }
    }

    /**
     * Handle get portfolio
     */
    private async handleGetPortfolio(sessionId: string): Promise<VoiceCommandResponse> {
        try {
            const result = await this.walletQueryService.getPortfolioValue();
            
            return {
                success: result.success,
                message: result.message,
                spokenMessage: result.spokenMessage || result.message,
                data: result.data,
                continueListening: true,
                sessionId
            };
        } catch (error) {
            const errorMessage = "I couldn't fetch your portfolio data right now.";
            return {
                success: false,
                message: errorMessage,
                spokenMessage: errorMessage,
                continueListening: true,
                sessionId
            };
        }
    }

    /**
     * Handle get token holdings
     */
    private async handleGetTokenHoldings(parameters: any, sessionId: string): Promise<VoiceCommandResponse> {
        try {
            const { minValue, tokenSymbol } = parameters || {};
            const queryParams: any = {};
            
            if (minValue && !isNaN(parseFloat(minValue))) {
                queryParams.minValue = parseFloat(minValue);
            }
            if (tokenSymbol) {
                queryParams.symbol = tokenSymbol;
            }

            const result = await this.walletQueryService.getTokenHoldings(queryParams);
            
            return {
                success: result.success,
                message: result.message,
                spokenMessage: result.spokenMessage || result.message,
                data: result.data,
                continueListening: true,
                sessionId
            };
        } catch (error) {
            const errorMessage = "I couldn't fetch your token holdings right now.";
            return {
                success: false,
                message: errorMessage,
                spokenMessage: errorMessage,
                continueListening: true,
                sessionId
            };
        }
    }

    /**
     * Handle get wallet summary
     */
    private async handleGetWalletSummary(sessionId: string): Promise<VoiceCommandResponse> {
        try {
            const result = await this.walletQueryService.getWalletSummary();
            
            return {
                success: result.success,
                message: result.message,
                spokenMessage: result.spokenMessage || result.message,
                data: result.data,
                continueListening: true,
                sessionId
            };
        } catch (error) {
            const errorMessage = "I couldn't generate your wallet summary right now.";
            return {
                success: false,
                message: errorMessage,
                spokenMessage: errorMessage,
                continueListening: true,
                sessionId
            };
        }
    }

    /**
     * Handle get wallet activity
     */
    private async handleGetWalletActivity(parameters: any, sessionId: string): Promise<VoiceCommandResponse> {
        try {
            const { limit, filter } = parameters || {};
            const transactionLimit = limit && !isNaN(parseInt(limit)) ? parseInt(limit) : 20;
            
            let result;
            if (filter && ['incoming', 'outgoing', 'recent'].includes(filter.toLowerCase())) {
                result = await this.walletQueryService.getFilteredWalletActivity(filter.toLowerCase(), transactionLimit);
            } else {
                result = await this.walletQueryService.getWalletActivity(transactionLimit);
            }
            
            return {
                success: result.success,
                message: result.message,
                spokenMessage: result.spokenMessage || result.message,
                data: result.data,
                continueListening: true,
                sessionId
            };
        } catch (error) {
            const errorMessage = "I couldn't fetch your wallet activity right now.";
            return {
                success: false,
                message: errorMessage,
                spokenMessage: errorMessage,
                continueListening: true,
                sessionId
            };
        }
    }

    /**
     * Handle ETH transfer with confirmation
     */
    private async handleTransferETH(parameters: any, originalText: string, sessionId: string): Promise<VoiceCommandResponse> {
        try {
            // Check if we already have a pending transfer
            const transferResult = await this.physicalWalletService.processTransferCommand(originalText);
            
            if (!transferResult.success) {
                return {
                    success: false,
                    message: transferResult.error || "Transfer failed",
                    spokenMessage: transferResult.spokenMessage || "Transfer failed. Please check your command and try again.",
                    continueListening: true,
                    sessionId
                };
            }

            // For successful transfers, ask for confirmation on large amounts
            const amount = parseFloat(parameters?.amount || '0');
            if (amount > 0.1) { // Require confirmation for transfers > 0.1 ETH
                conversationManager.setAwaitingConfirmation(sessionId, 'CONFIRM_TRANSFER', {
                    transferData: transferResult,
                    originalText
                });

                const confirmMessage = `I'm ready to send ${amount} ETH. This is a significant amount. Please say 'yes, confirm' or 'confirm' to proceed, or 'cancel' to stop.`;
                
                return {
                    success: true,
                    message: confirmMessage,
                    spokenMessage: confirmMessage,
                    requiresConfirmation: true,
                    continueListening: true,
                    sessionId
                };
            }

            // Small transfers proceed directly
            const successMessage = transferResult.spokenMessage || "Transfer completed successfully!";
            await uiSyncService.showSuccessState("Transfer Sent!");
            
            return {
                success: true,
                message: successMessage,
                spokenMessage: successMessage,
                data: transferResult,
                continueListening: true,
                sessionId
            };

        } catch (error) {
            const errorMessage = "I had trouble processing your transfer. Please try again.";
            return {
                success: false,
                message: errorMessage,
                spokenMessage: errorMessage,
                continueListening: true,
                sessionId
            };
        }
    }

    /**
     * Handle wallet monitoring
     */
    private async handleMonitorWallet(parameters: any, sessionId: string): Promise<VoiceCommandResponse> {
        // Implementation for wallet monitoring
        const message = "Wallet monitoring feature is being set up for you.";
        return {
            success: true,
            message,
            spokenMessage: message,
            continueListening: true,
            sessionId
        };
    }

    /**
     * Handle confirmation responses
     */
    private async handleConfirmationResponse(
        text: string,
        sessionId: string,
        pendingConfirmation: NonNullable<ConversationContext['awaitingConfirmation']>
    ): Promise<VoiceCommandResponse> {
        const normalizedText = text.toLowerCase().trim();
        const isConfirm = ['yes', 'confirm', 'yes confirm', 'proceed', 'go ahead', 'do it'].some(phrase => 
            normalizedText.includes(phrase)
        );
        const isCancel = ['no', 'cancel', 'stop', 'abort', 'dont', "don't"].some(phrase => 
            normalizedText.includes(phrase)
        );

        conversationManager.clearPendingConfirmation(sessionId);

        if (isConfirm) {
            // Execute the confirmed action
            if (pendingConfirmation.action === 'CONFIRM_TRANSFER') {
                const transferData = pendingConfirmation.parameters.transferData;
                await uiSyncService.showSuccessState("Transfer Confirmed!");
                
                const successMessage = "Great! Transfer has been confirmed and sent. Your transaction is processing.";
                return {
                    success: true,
                    message: successMessage,
                    spokenMessage: successMessage,
                    data: transferData,
                    continueListening: true,
                    sessionId
                };
            }
        } else if (isCancel) {
            const cancelMessage = "Okay, I've cancelled that operation. What else can I help you with?";
            return {
                success: true,
                message: cancelMessage,
                spokenMessage: cancelMessage,
                continueListening: true,
                sessionId
            };
        }

        // Unclear response
        const clarifyMessage = "I didn't understand. Please say 'yes' or 'confirm' to proceed, or 'cancel' to stop.";
        conversationManager.setAwaitingConfirmation(sessionId, pendingConfirmation.action, pendingConfirmation.parameters);
        
        return {
            success: false,
            message: clarifyMessage,
            spokenMessage: clarifyMessage,
            requiresConfirmation: true,
            continueListening: true,
            sessionId
        };
    }

    /**
     * Handle market-related commands
     */
    private async handleMarketCommand(text: string, sessionId: string): Promise<VoiceCommandResponse> {
        try {
            const context = conversationManager.getOrCreateContext(sessionId);
            const marketResult = await this.marketCommandRouter.processMarketCommand(text, context);
            
            const displayMessage = marketResult.response.length > 100 
                ? marketResult.response.substring(0, 97) + "..."
                : marketResult.response;

            return {
                success: marketResult.success,
                message: marketResult.response,
                spokenMessage: marketResult.response,
                displayMessage,
                data: marketResult.data,
                requiresConfirmation: marketResult.requiresConfirmation || false,
                continueListening: true,
                sessionId
            };
        } catch (error) {
            console.error('Error handling market command:', error);
            const errorMessage = "I had trouble accessing market data. Please try again.";
            return {
                success: false,
                message: errorMessage,
                spokenMessage: errorMessage,
                continueListening: true,
                sessionId
            };
        }
    }

    /**
     * Handle session control commands
     */
    private async handleSessionControl(text: string, sessionId: string): Promise<VoiceCommandResponse> {
        const normalizedText = text.toLowerCase().trim();
        
        if (['exit', 'quit', 'goodbye', 'stop', 'end session'].some(phrase => normalizedText.includes(phrase))) {
            conversationManager.endSession(sessionId);
            await uiSyncService.clearDisplay();
            
            const farewell = "Goodbye! Thanks for using Pluto. I'll be here when you need me again.";
            return {
                success: true,
                message: farewell,
                spokenMessage: farewell,
                continueListening: false,
                sessionId
            };
        }

        return {
            success: false,
            message: "Unknown session command",
            spokenMessage: "I didn't understand that command",
            continueListening: true,
            sessionId
        };
    }

    /**
     * Check if command is a session control command
     */
    private isSessionControlCommand(text: string): boolean {
        const normalizedText = text.toLowerCase().trim();
        return ['exit', 'quit', 'goodbye', 'stop', 'end session', 'bye'].some(phrase => 
            normalizedText.includes(phrase)
        );
    }
}

export default VoiceCommandRouter;
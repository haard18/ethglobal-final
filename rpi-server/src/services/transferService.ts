import { WalletStorageService, type StoredWallet } from '../functions/walletStorage.js';
import { EthereumWalletGenerator, type TransferResult } from '../functions/walletCreation.js';
import { speakText } from '../output/speak.js';
import { PhysicalWalletService } from './physicalWallet.js';

export interface TransferRequest {
    toAddress: string;
    amount: string;
    rpcUrl?: string;
}

export interface TransferResponse {
    success: boolean;
    message: string;
    result?: TransferResult;
    walletUsed?: string;
    error?: string;
}

export class TransferService {
    private physicalWalletService: PhysicalWalletService;

    constructor(physicalWalletService: PhysicalWalletService) {
        this.physicalWalletService = physicalWalletService;
    }

    /**
     * Voice-activated transfer with comprehensive wallet management
     */
    async performVoiceActivatedTransfer(
        toAddress: string, 
        amount: string, 
        rpcUrl?: string
    ): Promise<TransferResponse> {
        try {
            console.log(`💰 Voice transfer requested: ${amount} ETH to ${toAddress}`);
            
            // Check if any wallets exist
            const walletCount = WalletStorageService.getWalletCount();
            console.log(`📊 Found ${walletCount} wallet(s) in storage`);

            if (walletCount === 0) {
                return await this.handleNoWalletsScenario();
            }

            // Get the first wallet from storage
            const firstWallet = this.getFirstWallet();
            if (!firstWallet) {
                return await this.handleNoWalletsScenario();
            }

            // Announce the transfer attempt
            await this.announceTransferAttempt(firstWallet, toAddress, amount);

            // Perform the transfer
            const transferResult = await this.executeTransfer(firstWallet, toAddress, amount, rpcUrl);

            // Announce the result
            await this.announceTransferResult(transferResult, firstWallet.walletInfo.address);

            return {
                success: transferResult.success,
                message: transferResult.success ? 'Transfer completed successfully' : 'Transfer failed',
                result: transferResult,
                walletUsed: firstWallet.walletInfo.address,
                ...(transferResult.error && { error: transferResult.error })
            };

        } catch (error) {
            const errorMessage = `Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error('❌ Transfer service error:', error);
            
            speakText(`Transfer failed. ${error instanceof Error ? error.message : 'Please check the details and try again.'}`);
            
            return {
                success: false,
                message: errorMessage,
                error: errorMessage
            };
        }
    }

    /**
     * Get the first available wallet from storage
     */
    private getFirstWallet(): StoredWallet | null {
        try {
            const allWallets = WalletStorageService.getAllWallets();
            if (allWallets.length === 0) {
                return null;
            }
            
            // Sort by most recently used, then return the first one
            const sortedWallets = allWallets.sort((a, b) => 
                new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
            );
            
            return sortedWallets[0] || null;
        } catch (error) {
            console.error('❌ Error getting first wallet:', error);
            return null;
        }
    }

    /**
     * Handle scenario when no wallets exist
     */
    private async handleNoWalletsScenario(): Promise<TransferResponse> {
        const message = "No wallets found in your account. You need to create a wallet first before you can make transfers. Would you like me to create a new wallet for you?";
        
        console.log('⚠️ No wallets found for transfer');
        speakText(message);
        
        return {
            success: false,
            message: "No wallets available for transfer",
            error: "No wallets found. Create a wallet first."
        };
    }

    /**
     * Announce transfer attempt with wallet and transaction details
     */
    private async announceTransferAttempt(wallet: StoredWallet, toAddress: string, amount: string): Promise<void> {
        const shortFromAddress = `${wallet.walletInfo.address.slice(0, 6)}...${wallet.walletInfo.address.slice(-4)}`;
        const shortToAddress = toAddress.endsWith('.eth') ? toAddress : `${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`;
        
        const message = `Initiating transfer of ${amount} ETH from wallet ${shortFromAddress} to ${shortToAddress}. Please wait while I process the transaction.`;
        
        console.log(`🔊 Announcing transfer: ${message}`);
        speakText(message);
        
        // Add a small delay to let the announcement finish
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    /**
     * Execute the actual transfer
     */
    private async executeTransfer(
        wallet: StoredWallet, 
        toAddress: string, 
        amount: string, 
        rpcUrl?: string
    ): Promise<TransferResult> {
        try {
            console.log(`💸 Executing transfer from ${wallet.walletInfo.address} to ${toAddress}`);
            
            const transferResult = await EthereumWalletGenerator.transferETH(
                wallet.walletInfo,
                toAddress,
                amount,
                rpcUrl
            );
            
            return transferResult;
        } catch (error) {
            console.error('❌ Transfer execution failed:', error);
            return {
                success: false,
                error: `Transfer execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Announce transfer result with detailed feedback
     */
    private async announceTransferResult(result: TransferResult, fromAddress: string): Promise<void> {
        const shortFromAddress = `${fromAddress.slice(0, 6)}...${fromAddress.slice(-4)}`;
        
        if (result.success && result.transactionHash) {
            const shortTxHash = `${result.transactionHash.slice(0, 8)}...${result.transactionHash.slice(-6)}`;
            const message = `Transfer successful! Transaction hash ${shortTxHash}. The transfer from wallet ${shortFromAddress} has been completed.`;
            
            console.log(`✅ Transfer success announced`);
            speakText(message);
        } else {
            const errorReason = this.parseTransferError(result.error || 'Unknown error');
            const message = `Transfer failed. ${errorReason} Please check your wallet balance and transaction details.`;
            
            console.log(`❌ Transfer failure announced: ${errorReason}`);
            speakText(message);
        }
    }

    /**
     * Parse transfer error into user-friendly message
     */
    private parseTransferError(error: string): string {
        if (error.includes('Insufficient balance')) {
            return 'You do not have enough ETH in your wallet for this transfer.';
        }
        if (error.includes('Invalid address')) {
            return 'The destination address is not valid.';
        }
        if (error.includes('Could not resolve ENS')) {
            return 'The ENS name could not be resolved to an address.';
        }
        if (error.includes('gas')) {
            return 'There was an issue with transaction gas fees.';
        }
        if (error.includes('network')) {
            return 'There was a network connectivity issue.';
        }
        
        return 'An unexpected error occurred during the transfer.';
    }

    /**
     * Get transfer-ready wallet summary for voice feedback
     */
    async getWalletSummaryForTransfer(): Promise<string> {
        const walletCount = WalletStorageService.getWalletCount();
        
        if (walletCount === 0) {
            return "You have no wallets available for transfers. Create a wallet first.";
        }
        
        const firstWallet = this.getFirstWallet();
        if (!firstWallet) {
            return "No valid wallets found for transfers.";
        }
        
        const shortAddress = `${firstWallet.walletInfo.address.slice(0, 6)}...${firstWallet.walletInfo.address.slice(-4)}`;
        const label = firstWallet.metadata?.label || 'Unnamed Wallet';
        
        if (walletCount === 1) {
            return `You have 1 wallet available: ${label} with address ${shortAddress}. This wallet will be used for transfers.`;
        } else {
            return `You have ${walletCount} wallets available. The primary wallet ${label} with address ${shortAddress} will be used for transfers.`;
        }
    }

    /**
     * Prompt user for wallet creation when no wallets exist
     */
    async promptWalletCreation(): Promise<boolean> {
        const message = "I can create a new wallet for you right now. This will generate a secure Ethereum wallet that you can use for transfers. Should I proceed with creating a new wallet?";
        
        console.log('💡 Prompting wallet creation');
        speakText(message);
        
        // Return true to indicate that wallet creation was offered
        // In a real implementation, you might want to wait for user voice confirmation
        return true;
    }

    /**
     * Create wallet through voice command flow
     */
    async createWalletForTransfer(): Promise<{ success: boolean; address?: string; message: string }> {
        try {
            speakText("Creating a new wallet for you now. Please wait.");
            
            const newWallet = await this.physicalWalletService.generatePhysicalWallet();
            
            return {
                success: true,
                address: newWallet.walletInfo.address,
                message: "Wallet created successfully. You can now make transfers."
            };
        } catch (error) {
            const errorMessage = `Failed to create wallet: ${error instanceof Error ? error.message : 'Unknown error'}`;
            speakText(`Wallet creation failed. ${errorMessage}`);
            
            return {
                success: false,
                message: errorMessage
            };
        }
    }
}
import { EthereumWalletGenerator, type WalletInfo } from '../wallet/index.js';
import { TokenAPIService, type WalletData, type Transaction } from '../graph/tokenApi.js';

export interface PhysicalWallet {
    walletInfo: WalletInfo;
    walletData: WalletData | null;
    isMonitoring: boolean;
    createdAt: Date;
    lastUpdated: Date;
}

export class PhysicalWalletService {
    private tokenApiService: TokenAPIService;
    private wallets: Map<string, PhysicalWallet> = new Map();

    constructor(etherscanApiKey?: string, rpcUrl?: string) {
        this.tokenApiService = new TokenAPIService(etherscanApiKey, rpcUrl);
    }

    /**
     * Generates a new physical wallet with Ethereum address
     */
    async generatePhysicalWallet(): Promise<PhysicalWallet> {
        const walletInfo = EthereumWalletGenerator.generateWallet();
        
        const physicalWallet: PhysicalWallet = {
            walletInfo,
            walletData: null,
            isMonitoring: false,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        // Store the wallet
        this.wallets.set(walletInfo.address, physicalWallet);

        // Fetch initial wallet data
        try {
            const walletData = await this.tokenApiService.getWalletData(walletInfo.address);
            physicalWallet.walletData = walletData;
            physicalWallet.lastUpdated = new Date();
        } catch (error) {
            console.warn(`Could not fetch initial wallet data for ${walletInfo.address}:`, error);
        }

        return physicalWallet;
    }

    /**
     * Import existing wallet from private key
     */
    async importWalletFromPrivateKey(privateKey: string): Promise<PhysicalWallet> {
        const walletInfo = EthereumWalletGenerator.fromPrivateKey(privateKey);
        
        const physicalWallet: PhysicalWallet = {
            walletInfo,
            walletData: null,
            isMonitoring: false,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        // Store the wallet
        this.wallets.set(walletInfo.address, physicalWallet);

        // Fetch wallet data
        try {
            const walletData = await this.tokenApiService.getWalletData(walletInfo.address);
            physicalWallet.walletData = walletData;
            physicalWallet.lastUpdated = new Date();
        } catch (error) {
            console.warn(`Could not fetch wallet data for ${walletInfo.address}:`, error);
        }

        return physicalWallet;
    }

    /**
     * Import existing wallet from mnemonic
     */
    async importWalletFromMnemonic(mnemonic: string): Promise<PhysicalWallet> {
        const walletInfo = EthereumWalletGenerator.fromMnemonic(mnemonic);
        
        const physicalWallet: PhysicalWallet = {
            walletInfo,
            walletData: null,
            isMonitoring: false,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        // Store the wallet
        this.wallets.set(walletInfo.address, physicalWallet);

        // Fetch wallet data
        try {
            const walletData = await this.tokenApiService.getWalletData(walletInfo.address);
            physicalWallet.walletData = walletData;
            physicalWallet.lastUpdated = new Date();
        } catch (error) {
            console.warn(`Could not fetch wallet data for ${walletInfo.address}:`, error);
        }

        return physicalWallet;
    }

    /**
     * Start monitoring a wallet for new transactions
     */
    async startWalletMonitoring(address: string, intervalMs: number = 30000): Promise<void> {
        const wallet = this.wallets.get(address);
        if (!wallet) {
            throw new Error(`Wallet ${address} not found`);
        }

        if (wallet.isMonitoring) {
            console.log(`Wallet ${address} is already being monitored`);
            return;
        }

        wallet.isMonitoring = true;

        const transactionCallback = async (transaction: Transaction) => {
            console.log(`New transaction detected for wallet ${address}:`, {
                id: transaction.id,
                from: transaction.from,
                to: transaction.to,
                value: transaction.value,
                timestamp: new Date(parseInt(transaction.timestamp) * 1000).toISOString()
            });

            // Update wallet data when new transaction is detected
            try {
                const updatedWalletData = await this.tokenApiService.getWalletData(address);
                wallet.walletData = updatedWalletData;
                wallet.lastUpdated = new Date();
            } catch (error) {
                console.error(`Failed to update wallet data for ${address}:`, error);
            }
        };

        // Start monitoring
        await this.tokenApiService.startWalletMonitoring(address, transactionCallback, intervalMs);
    }

    /**
     * Get wallet by address
     */
    getWallet(address: string): PhysicalWallet | undefined {
        return this.wallets.get(address);
    }

    /**
     * Get all wallets
     */
    getAllWallets(): PhysicalWallet[] {
        return Array.from(this.wallets.values());
    }

    /**
     * Update wallet data manually
     */
    async updateWalletData(address: string): Promise<WalletData> {
        const wallet = this.wallets.get(address);
        if (!wallet) {
            throw new Error(`Wallet ${address} not found`);
        }

        try {
            const walletData = await this.tokenApiService.getWalletData(address);
            wallet.walletData = walletData;
            wallet.lastUpdated = new Date();
            return walletData;
        } catch (error) {
            throw new Error(`Failed to update wallet data: ${error}`);
        }
    }

    /**
     * Get wallet transactions
     */
    async getWalletTransactions(address: string, limit: number = 10): Promise<Transaction[]> {
        const wallet = this.wallets.get(address);
        if (!wallet) {
            throw new Error(`Wallet ${address} not found`);
        }

        return await this.tokenApiService.getWalletTransactions(address, limit);
    }

    /**
     * Stop monitoring a wallet
     */
    stopWalletMonitoring(address: string): void {
        const wallet = this.wallets.get(address);
        if (wallet) {
            wallet.isMonitoring = false;
            console.log(`Stopped monitoring wallet ${address}`);
        }
    }

    /**
     * Remove wallet from service
     */
    removeWallet(address: string): boolean {
        const wallet = this.wallets.get(address);
        if (wallet) {
            if (wallet.isMonitoring) {
                this.stopWalletMonitoring(address);
            }
            return this.wallets.delete(address);
        }
        return false;
    }
}
import { EthereumWalletGenerator, type WalletInfo, type TransferResult } from '../functions/walletCreation.js';
import { GraphProtocolService, type WalletData, type Transaction } from '../graph/market/walletmonitor.js';
import { WalletStorageService } from '../functions/walletStorage.js';

export interface PhysicalWallet {
  walletInfo: WalletInfo;
  walletData: WalletData | null;
  isMonitoring: boolean;
  createdAt: Date;
  lastUpdated: Date;
}

export class PhysicalWalletService {
  private graphProtocolService: GraphProtocolService;
  private wallets: Map<string, PhysicalWallet> = new Map();

  constructor() {
    this.graphProtocolService = new GraphProtocolService();
  }

    /**
     * Generates a new physical wallet with Ethereum address (with persistent storage)
     */
    async generatePhysicalWallet(): Promise<PhysicalWallet> {
        // Check if wallet already exists in storage
        const existingWallet = WalletStorageService.loadWallet();
        if (existingWallet) {
            console.log('🔄 Found existing wallet in storage, loading instead of creating new one');
            return this.loadExistingWallet(existingWallet.walletInfo);
        }

        const walletInfo = EthereumWalletGenerator.generateWallet();
        
        const physicalWallet: PhysicalWallet = {
            walletInfo,
            walletData: null,
            isMonitoring: false,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        // Store the wallet in memory
        this.wallets.set(walletInfo.address, physicalWallet);

        // Save to persistent storage
        WalletStorageService.saveWallet(walletInfo, {
            label: 'Main Wallet',
            notes: 'Generated via Physical Wallet Service'
        });

    // Fetch initial wallet data
    try {
      const walletData = await this.graphProtocolService.getWalletData(walletInfo.address);
      physicalWallet.walletData = walletData;
      physicalWallet.lastUpdated = new Date();
    } catch (error) {
      console.warn(`Could not fetch initial wallet data for ${walletInfo.address}:`, error);
    }

        return physicalWallet;
    }

    /**
     * Load existing wallet from storage
     */
    private async loadExistingWallet(walletInfo: WalletInfo): Promise<PhysicalWallet> {
        const physicalWallet: PhysicalWallet = {
            walletInfo,
            walletData: null,
            isMonitoring: false,
            createdAt: new Date(), // This could be stored in metadata
            lastUpdated: new Date()
        };

        // Store in memory
        this.wallets.set(walletInfo.address, physicalWallet);

        // Fetch current wallet data
        try {
            const walletData = await this.graphProtocolService.getWalletData(walletInfo.address);
            physicalWallet.walletData = walletData;
            physicalWallet.lastUpdated = new Date();
        } catch (error) {
            console.warn(`Could not fetch wallet data for ${walletInfo.address}:`, error);
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
      lastUpdated: new Date(),
    };

    // Store the wallet
    this.wallets.set(walletInfo.address, physicalWallet);

    // Fetch wallet data
    try {
      const walletData = await this.graphProtocolService.getWalletData(walletInfo.address);
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
      lastUpdated: new Date(),
    };

    // Store the wallet
    this.wallets.set(walletInfo.address, physicalWallet);

    // Fetch wallet data
    try {
      const walletData = await this.graphProtocolService.getWalletData(walletInfo.address);
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
        id: transaction.transaction_id,
        from: transaction.from,
        to: transaction.to,
        value: transaction.value,
        datetime: transaction.datetime,
      });

      // Update wallet data when a new transaction is detected
      try {
        const updatedWalletData = await this.graphProtocolService.getWalletData(address);
        wallet.walletData = updatedWalletData;
        wallet.lastUpdated = new Date();
      } catch (error) {
        console.error(`Failed to update wallet data for ${address}:`, error);
      }
    };

    // Start monitoring
    await this.graphProtocolService.startWalletMonitoring(
      address,
      transactionCallback,
      intervalMs
    );
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
      const walletData = await this.graphProtocolService.getWalletData(address);
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

    return await this.graphProtocolService.getWalletTransactions(address, 'mainnet', limit);
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
     * Transfer ETH from stored wallet to ENS or address
     */
    async transferETH(
        fromAddress: string,
        toAddressOrEns: string,
        amount: string,
        rpcUrl?: string
    ): Promise<TransferResult> {
        const wallet = this.wallets.get(fromAddress);
        if (!wallet) {
            throw new Error(`Wallet ${fromAddress} not found in service`);
        }

        return await EthereumWalletGenerator.transferETH(
            wallet.walletInfo,
            toAddressOrEns,
            amount,
            rpcUrl
        );
    }

    /**
     * Transfer from the main stored wallet (convenience method)
     */
    async transferFromMainWallet(
        toAddressOrEns: string,
        amount: string,
        rpcUrl?: string
    ): Promise<TransferResult> {
        // Try to get wallet from storage first
        const storedWallet = WalletStorageService.loadWallet();
        if (!storedWallet) {
            throw new Error('No wallet found in storage. Please create a wallet first.');
        }

        // Load into memory if not already there
        if (!this.wallets.has(storedWallet.walletInfo.address)) {
            await this.loadExistingWallet(storedWallet.walletInfo);
        }

        return await this.transferETH(
            storedWallet.walletInfo.address,
            toAddressOrEns,
            amount,
            rpcUrl
        );
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

    /**
     * Get the main wallet storage path (for GPT reference)
     */
    getWalletStoragePath(): string {
        return WalletStorageService.getStoragePath();
    }

    /**
     * Check if main wallet exists in storage
     */
    hasStoredWallet(): boolean {
        return WalletStorageService.hasWallet();
    }

    /**
     * Get stored wallet address
     */
    getStoredWalletAddress(): string | null {
        return WalletStorageService.getWalletAddress();
    }
}

import { WalletStorageService, type StoredWallet } from  '../../functions/walletStorage.js';
import { type WalletInfo } from '../../functions/walletCreation.js';

// Types for Graph Protocol data
export interface WalletData {
  address: string;
  balance: string;
  transactionCount: number;
  lastTransaction?: Transaction;
  tokenBalances?: Array<{
    address: string;
    balance: string;
    symbol: string;
    decimals: number;
  }>;
}

export interface Transaction {
  transaction_id: string;
  from: string;
  to: string;
  value: string;
  datetime: string;
  timestamp: number;
  blockNumber?: number;
  gasUsed?: string;
  gasPrice?: string;
  symbol?: string;
  decimals?: number;
}

// Graph Protocol Service for fetching wallet data
export class GraphProtocolService {
  constructor() {
    // Initialize service
  }

  async getWalletData(address: string): Promise<WalletData> {
    // Mock implementation - replace with actual Graph Protocol API calls
    return {
      address,
      balance: "0",
      transactionCount: 0,
    };
  }

  async getWalletTransactions(address: string, network: string, limit: number): Promise<Transaction[]> {
    // Mock implementation - replace with actual Graph Protocol API calls
    return [];
  }

  async startWalletMonitoring(
    address: string,
    callback: (transaction: Transaction) => void,
    intervalMs: number
  ): Promise<void> {
    // Mock implementation - replace with actual monitoring logic
    console.log(`Starting monitoring for ${address} with interval ${intervalMs}ms`);
  }
}

// Wallet monitoring status
export interface WalletMonitor {
  walletInfo: WalletInfo;
  walletData: WalletData | null;
  isMonitoring: boolean;
  lastUpdated: Date;
  monitoringInterval?: NodeJS.Timeout;
}

// Wallet monitoring service
export class WalletMonitorService {
  private graphProtocolService: GraphProtocolService;
  private monitoredWallets: Map<string, WalletMonitor> = new Map();

  constructor() {
    this.graphProtocolService = new GraphProtocolService();
  }

  /**
   * Load all stored wallets and start monitoring them
   */
  public async initialize(): Promise<void> {
    console.log('🔍 Initializing wallet monitor service...');
    const storedWallet = WalletStorageService.loadWallet();
    if (storedWallet) {
      await this.addWalletToMonitor(storedWallet.walletInfo);
    } else {
      console.log('ℹ️ No stored wallets found to monitor');
    }
  }

  /**
   * Add a wallet to the monitoring service
   */
  public async addWalletToMonitor(walletInfo: WalletInfo): Promise<WalletMonitor> {
    const walletAddress = walletInfo.address.toLowerCase();

    // Skip if already monitoring
    if (this.monitoredWallets.has(walletAddress)) {
      console.log(`⚠️ Wallet ${walletAddress} is already being monitored`);
      return this.monitoredWallets.get(walletAddress)!;
    }

    // Create new wallet monitor entry
    const walletMonitor: WalletMonitor = {
      walletInfo,
      walletData: null,
      isMonitoring: false,
      lastUpdated: new Date(),
    };

    // Add to monitored wallets
    this.monitoredWallets.set(walletAddress, walletMonitor);

    // Fetch initial wallet data
    try {
      const walletData = await this.graphProtocolService.getWalletData(walletAddress);
      walletMonitor.walletData = walletData;
      walletMonitor.lastUpdated = new Date();
      console.log(`📥 Initial wallet data fetched for ${walletAddress}`);
    } catch (error) {
      console.warn(`⚠️ Could not fetch initial wallet data for ${walletAddress}:`, error);
    }

    return walletMonitor;
  }

  /**
   * Start monitoring a wallet for transactions and balance changes
   */
  public async startMonitoring(walletAddress: string, intervalMs: number = 30000): Promise<void> {
    walletAddress = walletAddress.toLowerCase();
    const walletMonitor = this.monitoredWallets.get(walletAddress);

    if (!walletMonitor) {
      throw new Error(`Wallet ${walletAddress} not found in monitoring service`);
    }

    if (walletMonitor.isMonitoring) {
      console.log(`ℹ️ Wallet ${walletAddress} is already being monitored`);
      return;
    }

    // Mark as monitoring
    walletMonitor.isMonitoring = true;

    // Define transaction callback
    const transactionCallback = async (transaction: Transaction) => {
      console.log(`🔄 New transaction detected for wallet ${walletAddress}:`, {
        id: transaction.transaction_id,
        from: transaction.from,
        to: transaction.to,
        value: transaction.value,
        datetime: transaction.datetime,
      });

      // Update wallet data
      try {
        const updatedWalletData = await this.graphProtocolService.getWalletData(walletAddress);
        walletMonitor.walletData = updatedWalletData;
        walletMonitor.lastUpdated = new Date();
        console.log(`📥 Wallet data updated for ${walletAddress}`);
      } catch (error) {
        console.error(`❌ Failed to update wallet data for ${walletAddress}:`, error);
      }
    };

    // Start monitoring
    await this.graphProtocolService.startWalletMonitoring(
      walletAddress,
      transactionCallback,
      intervalMs
    );

    console.log(`👁️ Started monitoring wallet ${walletAddress} (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop monitoring a wallet
   */
  public stopMonitoring(walletAddress: string): void {
    walletAddress = walletAddress.toLowerCase();
    const walletMonitor = this.monitoredWallets.get(walletAddress);

    if (!walletMonitor) {
      throw new Error(`Wallet ${walletAddress} not found in monitoring service`);
    }

    if (!walletMonitor.isMonitoring) {
      console.log(`ℹ️ Wallet ${walletAddress} is not being monitored`);
      return;
    }

    // Clear monitoring interval if exists
    if (walletMonitor.monitoringInterval) {
      clearInterval(walletMonitor.monitoringInterval);
    }

    walletMonitor.isMonitoring = false;
    console.log(`🛑 Stopped monitoring wallet ${walletAddress}`);
  }

  /**
   * Get wallet monitor by address
   */
  public getWalletMonitor(walletAddress: string): WalletMonitor | undefined {
    walletAddress = walletAddress.toLowerCase();
    return this.monitoredWallets.get(walletAddress);
  }

  /**
   * Get all monitored wallets
   */
  public getAllMonitoredWallets(): WalletMonitor[] {
    return Array.from(this.monitoredWallets.values());
  }

  /**
   * Update wallet data manually
   */
  public async updateWalletData(walletAddress: string): Promise<WalletData> {
    walletAddress = walletAddress.toLowerCase();
    const walletMonitor = this.monitoredWallets.get(walletAddress);

    if (!walletMonitor) {
      throw new Error(`Wallet ${walletAddress} not found in monitoring service`);
    }

    try {
      const walletData = await this.graphProtocolService.getWalletData(walletAddress);
      walletMonitor.walletData = walletData;
      walletMonitor.lastUpdated = new Date();
      return walletData;
    } catch (error) {
      throw new Error(`Failed to update wallet data: ${error}`);
    }
  }

  /**
   * Get wallet transactions
   */
  public async getWalletTransactions(walletAddress: string, limit: number = 10): Promise<Transaction[]> {
    walletAddress = walletAddress.toLowerCase();
    const walletMonitor = this.monitoredWallets.get(walletAddress);

    if (!walletMonitor) {
      throw new Error(`Wallet ${walletAddress} not found in monitoring service`);
    }

    return await this.graphProtocolService.getWalletTransactions(walletAddress, 'mainnet', limit);
  }

  /**
   * Remove a wallet from monitoring
   */
  public removeWallet(walletAddress: string): boolean {
    walletAddress = walletAddress.toLowerCase();
    const walletMonitor = this.monitoredWallets.get(walletAddress);

    if (!walletMonitor) {
      return false;
    }

    // Stop monitoring if active
    if (walletMonitor.isMonitoring) {
      this.stopMonitoring(walletAddress);
    }

    return this.monitoredWallets.delete(walletAddress);
  }

  /**
   * Check if a wallet is being monitored
   */
  public isWalletMonitored(walletAddress: string): boolean {
    walletAddress = walletAddress.toLowerCase();
    const walletMonitor = this.monitoredWallets.get(walletAddress);
    return !!walletMonitor && walletMonitor.isMonitoring;
  }
}

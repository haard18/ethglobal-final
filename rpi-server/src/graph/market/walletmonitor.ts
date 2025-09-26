import { WalletStorageService, type StoredWallet } from '../../functions/walletStorage.ts';
import { type WalletInfo } from '../../functions/walletCreation.ts';
import axios from 'axios';

export interface TokenBalance {
  block_num: number;
  last_balance_update: string;
  contract: string;
  amount: string;
  value: number;
  name: string;
  symbol: string;
  decimals: number;
  network_id: string;
}

export interface WalletData {
  address: string;
  balance: string;
  totalValueUSD: number;
  tokenBalances: TokenBalance[];
  transactionCount: number;
  lastTransaction?: Transaction | null;
}

export interface Transaction {
  block_num: number;
  datetime: string;
  timestamp: number;
  transaction_id: string;
  contract: string;
  from: string;
  to: string;
  decimals: number;
  symbol: string;
  value: number;
}

// Graph Protocol Service for fetching wallet data
export class GraphProtocolService {
  private endpoint: string;
  private jwtToken: string;

  constructor() {
    this.endpoint = 'https://token-api.thegraph.com';
    this.jwtToken = "eyJhbGciOiJLTVNFUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3OTQ4OTU2MTksImp0aSI6IjgwMjllZDg4LTY5ZWMtNDA2NC05OWFhLWFkNGY2ZDU0NWUwMiIsImlhdCI6MTc1ODg5NTYxOSwiaXNzIjoiZGZ1c2UuaW8iLCJzdWIiOiIwZGl6YTM4NWM5MmVhOTkzZGRhODIiLCJ2IjoyLCJha2kiOiIzMDVhZWZkNDE3YmJjNzgyNzAyY2FkN2IxMGViMzlkMTBlNTdiNWQ4MTU5M2ZkYTg2YWY4Yzk5YjljN2EwMDY0IiwidWlkIjoiMGRpemEzODVjOTJlYTk5M2RkYTgyIiwic3Vic3RyZWFtc19wbGFuX3RpZXIiOiJGUkVFIiwiY2ZnIjp7IlNVQlNUUkVBTVNfTUFYX1JFUVVFU1RTIjoiMiIsIlNVQlNUUkVBTVNfUEFSQUxMRUxfSk9CUyI6IjUiLCJTVUJTVFJFQU1TX1BBUkFMTEVMX1dPUktFUlMiOiI1In19.-BBfME1q4KdqXs4tmFstcwfJYDPxvT1Zl4RMfVlh29jDbzQHNIJA3OhT7NQsMDwNVEn0POHCHWHdpfCrOrgGHA"
    if (!this.jwtToken) {
      throw new Error('GRAPH_API_TOKEN is not set in .env');
    }
  }

  /**
   * Executes a GET request to The Graph Token API
   */
  private async executeGetRequest(path: string, params: Record<string, any> = {}): Promise<any> {
    try {
      const response = await axios.get(`${this.endpoint}${path}`, {
        params,
        headers: {
          Authorization: `Bearer ${this.jwtToken}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Token API error:', error);
      throw new Error(`Failed to execute request: ${error}`);
    }
  }

  /**
   * Gets wallet data including balances and transactions
   */
  async getWalletData(address: string, networkId: string = 'mainnet'): Promise<WalletData> {
    // Get current balances
    const balancesPath = `/balances/evm/${address}`;
    const balancesParams = { network_id: networkId, limit: 100 };
    const balancesResponse = await this.executeGetRequest(balancesPath, balancesParams);

    // Get recent transactions
    const transactionsPath = '/transfers/evm';
    const transactionsParams = {
      network_id: networkId,
      from: address,
      limit: 1,
      orderBy: 'timestamp',
      orderDirection: 'desc'
    };
    const transactionsResponse = await this.executeGetRequest(transactionsPath, transactionsParams);

    // Calculate total value
    const tokenBalances: TokenBalance[] = balancesResponse.data || [];
    const totalValueUSD = tokenBalances.reduce((sum: number, token: TokenBalance) => sum + token.value, 0);

    // Get last transaction if available
    const lastTransaction = transactionsResponse.data?.[0] || null;

    return {
      address,
      balance: tokenBalances.find(t => t.contract === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')?.amount || '0',
      totalValueUSD,
      tokenBalances,
      transactionCount: tokenBalances.length,
      lastTransaction
    };
  }

  /**
   * Gets wallet transactions
   */
  async getWalletTransactions(address: string, networkId: string = 'mainnet', limit: number = 10): Promise<Transaction[]> {
    const path = '/transfers/evm';
    const params = {
      network_id: networkId,
      from: address,
      limit,
      orderBy: 'timestamp',
      orderDirection: 'desc'
    };
    const response = await this.executeGetRequest(path, params);
    return response.data || [];
  }

  /**
   * Monitors wallet for new transactions (polling-based)
   */
  async startWalletMonitoring(
    address: string,
    callback: (transaction: Transaction) => void,
    intervalMs: number = 30000,
    networkId: string = 'mainnet'
  ): Promise<NodeJS.Timeout> {
    let lastTransactionId: string | null = null;

    const checkForNewTransactions = async () => {
      try {
        const transactions = await this.getWalletTransactions(address, networkId, 1);
        if (transactions.length > 0) {
          const latestTransaction = transactions[0];
          if (latestTransaction && (!lastTransactionId || latestTransaction.transaction_id !== lastTransactionId)) {
            callback(latestTransaction);
            lastTransactionId = latestTransaction.transaction_id;
          }
        }
      } catch (error) {
        console.error('Error monitoring wallet:', error);
      }
    };

    console.log(`Starting wallet monitoring for ${address} (${networkId}) with ${intervalMs}ms interval`);
    return setInterval(checkForNewTransactions, intervalMs);
  }
}

// Wallet monitoring status
export interface WalletMonitor {
  walletInfo: WalletInfo;
  walletData: WalletData | null;
  isMonitoring: boolean;
  lastUpdated: Date;
  monitoringInterval?: NodeJS.Timeout | undefined;
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

    // Start monitoring and store the interval ID
    walletMonitor.monitoringInterval = await this.graphProtocolService.startWalletMonitoring(
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
      walletMonitor.monitoringInterval = undefined;
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

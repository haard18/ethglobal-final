import axios from 'axios';

const GRAPH_API_TOKEN = process.env.GRAPH_API_TOKEN;
if (!GRAPH_API_TOKEN) {
  throw new Error('GRAPH_API_TOKEN is not set in .env');
}

const TOKEN_API_ENDPOINT = 'https://token-api.thegraph.com';

// Interfaces
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
  totalValueUSD: number;
  tokenBalances: TokenBalance[];
  transactionCount: number;
  lastActivity: string;
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

export class GraphProtocolService {
  private endpoint: string;

  constructor() {
    this.endpoint = TOKEN_API_ENDPOINT;
  }

  /**
   * Executes a GET request to The Graph Token API
   */
  private async executeGetRequest(path: string, params: Record<string, any> = {}): Promise<any> {
    try {
      const response = await axios.get(`${this.endpoint}${path}`, {
        params,
        headers: {
          'Authorization': `Bearer ${GRAPH_API_TOKEN}`,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Token API error:', error);
      throw new Error(`Failed to execute request: ${error}`);
    }
  }

  /**
   * Gets wallet token balances (current)
   */
  async getWalletData(address: string, networkId: string = 'mainnet'): Promise<WalletData> {
    const path = `/balances/evm/${address}`;
    const params = { network_id: networkId, limit: 100 };
    const response = await this.executeGetRequest(path, params);

    const tokenBalances: TokenBalance[] = response.data || [];
    const totalValueUSD = tokenBalances.reduce((sum: number, token: TokenBalance) => sum + token.value, 0);

    return {
      address,
      totalValueUSD,
      tokenBalances,
      transactionCount: tokenBalances.length,
      lastActivity: tokenBalances.length > 0 && tokenBalances[0] ? tokenBalances[0].last_balance_update : '0',
    };
  }

  /**
   * Gets historical wallet balances
   */
  async getHistoricalWalletData(
    address: string,
    startTime: number,
    endTime: number,
    networkId: string = 'mainnet'
  ): Promise<TokenBalance[]> {
    const path = `/historical/balances/evm/${address}`;
    const params = {
      network_id: networkId,
      startTime,
      endTime,
      limit: 100,
    };
    const response = await this.executeGetRequest(path, params);
    return response.data || [];
  }

  /**
   * Gets recent transfer events for a wallet
   */
  async getWalletTransactions(
    address: string,
    networkId: string = 'mainnet',
    limit: number = 10
  ): Promise<Transaction[]> {
    const path = '/transfers/evm';
    const params = {
      network_id: networkId,
      from: address,
      limit,
      orderBy: 'timestamp',
      orderDirection: 'desc',
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
  ): Promise<void> {
    let lastTransactionId: string | null = null;

    const checkForNewTransactions = async () => {
      try {
        const transactions = await this.getWalletTransactions(address, networkId, 1);
        if (transactions.length > 0) {
          const latestTransaction = transactions[0];
          if (latestTransaction && latestTransaction.transaction_id !== lastTransactionId) {
            callback(latestTransaction);
            lastTransactionId = latestTransaction.transaction_id;
          }
        }
      } catch (error) {
        console.error('Error monitoring wallet:', error);
      }
    };

    console.log(`Starting wallet monitoring for ${address} (${networkId}) with ${intervalMs}ms interval`);
    setInterval(checkForNewTransactions, intervalMs);
  }
}
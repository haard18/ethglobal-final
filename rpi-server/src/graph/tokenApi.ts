import axios from 'axios';
import { ethers } from 'ethers';

export interface TokenBalance {
    token: {
        id: string;
        symbol: string;
        name: string;
        decimals: string;
    };
    valueExact: string;
    valueUSD: string;
}

export interface WalletData {
    address: string;
    totalValueUSD: string;
    tokenBalances: TokenBalance[];
    transactionCount: number;
    lastActivity: string;
    ethBalance: string;
}

export interface Transaction {
    id: string;
    timestamp: string;
    from: string;
    to: string;
    value: string;
    gasUsed: string;
    gasPrice: string;
    token?: {
        symbol: string;
        name: string;
    };
}

export class TokenAPIService {
    private etherscanApiKey: string | undefined;
    private rpcProvider: ethers.JsonRpcProvider;

    constructor(etherscanApiKey?: string, rpcUrl?: string) {
        this.etherscanApiKey = etherscanApiKey;
        // Use public RPC endpoint or provided one
        this.rpcProvider = new ethers.JsonRpcProvider(rpcUrl || 'https://eth.llamarpc.com');
    }

    /**
     * Gets wallet ETH balance using RPC provider
     */
    async getETHBalance(address: string): Promise<string> {
        try {
            const balance = await this.rpcProvider.getBalance(address);
            return ethers.formatEther(balance);
        } catch (error) {
            console.error('Error fetching ETH balance:', error);
            return '0';
        }
    }

    /**
     * Gets wallet transaction count using RPC provider
     */
    async getTransactionCount(address: string): Promise<number> {
        try {
            return await this.rpcProvider.getTransactionCount(address);
        } catch (error) {
            console.error('Error fetching transaction count:', error);
            return 0;
        }
    }

    /**
     * Gets recent transactions using Etherscan API (if API key provided)
     */
    async getTransactionsFromEtherscan(address: string, limit: number = 10): Promise<Transaction[]> {
        if (!this.etherscanApiKey) {
            return []; // Return empty array if no API key
        }

        try {
            const response = await axios.get('https://api.etherscan.io/api', {
                params: {
                    module: 'account',
                    action: 'txlist',
                    address: address,
                    startblock: 0,
                    endblock: 99999999,
                    page: 1,
                    offset: limit,
                    sort: 'desc',
                    apikey: this.etherscanApiKey
                }
            });

            if (response.data.status === '1') {
                return response.data.result.map((tx: any) => ({
                    id: tx.hash,
                    timestamp: tx.timeStamp,
                    from: tx.from,
                    to: tx.to,
                    value: tx.value,
                    gasUsed: tx.gasUsed,
                    gasPrice: tx.gasPrice
                }));
            }
        } catch (error) {
            console.error('Etherscan API error:', error);
        }

        return [];
    }

    /**
     * Gets ERC-20 token balances using Etherscan API (if API key provided)
     */
    async getTokenBalancesFromEtherscan(address: string): Promise<TokenBalance[]> {
        if (!this.etherscanApiKey) {
            return []; // Return empty array if no API key
        }

        try {
            const response = await axios.get('https://api.etherscan.io/api', {
                params: {
                    module: 'account',
                    action: 'tokentx',
                    address: address,
                    page: 1,
                    offset: 100,
                    sort: 'desc',
                    apikey: this.etherscanApiKey
                }
            });

            if (response.data.status === '1') {
                // Group by token contract address to get unique tokens
                const tokenMap = new Map<string, any>();
                
                response.data.result.forEach((tx: any) => {
                    const tokenAddress = tx.contractAddress;
                    if (!tokenMap.has(tokenAddress)) {
                        tokenMap.set(tokenAddress, {
                            token: {
                                id: tokenAddress,
                                symbol: tx.tokenSymbol,
                                name: tx.tokenName,
                                decimals: tx.tokenDecimal
                            },
                            valueExact: '0', // Would need additional API call to get current balance
                            valueUSD: '0'
                        });
                    }
                });

                return Array.from(tokenMap.values()).slice(0, 10); // Return first 10 unique tokens
            }
        } catch (error) {
            console.error('Etherscan token API error:', error);
        }

        return [];
    }

    /**
     * Creates mock wallet data for demonstration purposes
     */
    private createMockWalletData(address: string, ethBalance: string, transactionCount: number): WalletData {
        // Create some mock token balances for demonstration
        const mockTokens: TokenBalance[] = [
            {
                token: {
                    id: '0xa0b86a33e6b4b8d7e3b8b7e3b0986733e6b2b8d7',
                    symbol: 'DEMO',
                    name: 'Demo Token',
                    decimals: '18'
                },
                valueExact: '1000000000000000000',
                valueUSD: '100.00'
            },
            {
                token: {
                    id: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                    symbol: 'WETH',
                    name: 'Wrapped Ethereum',
                    decimals: '18'
                },
                valueExact: '500000000000000000',
                valueUSD: '1250.00'
            }
        ];

        // Only add mock tokens if this is a newly generated address (very low activity)
        const hasLowActivity = transactionCount === 0 && parseFloat(ethBalance) === 0;

        return {
            address,
            totalValueUSD: hasLowActivity ? '1350.00' : ethBalance,
            tokenBalances: hasLowActivity ? mockTokens : [],
            transactionCount,
            lastActivity: hasLowActivity ? '0' : Math.floor(Date.now() / 1000).toString(),
            ethBalance
        };
    }

    /**
     * Gets comprehensive wallet data using multiple sources
     */
    async getWalletData(address: string): Promise<WalletData> {
        try {
            // Get basic data from RPC
            const [ethBalance, transactionCount] = await Promise.all([
                this.getETHBalance(address),
                this.getTransactionCount(address)
            ]);

            let tokenBalances: TokenBalance[] = [];
            
            // Try to get token balances from Etherscan if API key is available
            if (this.etherscanApiKey) {
                tokenBalances = await this.getTokenBalancesFromEtherscan(address);
            }

            // If no external data available, create mock data for demonstration
            if (!this.etherscanApiKey || (transactionCount === 0 && parseFloat(ethBalance) === 0)) {
                return this.createMockWalletData(address, ethBalance, transactionCount);
            }

            return {
                address,
                totalValueUSD: (parseFloat(ethBalance) * 2500).toFixed(2), // Mock ETH price
                tokenBalances,
                transactionCount,
                lastActivity: transactionCount > 0 ? Math.floor(Date.now() / 1000).toString() : '0',
                ethBalance
            };

        } catch (error) {
            console.error('Error fetching wallet data:', error);
            
            // Return basic structure with error indication
            return {
                address,
                totalValueUSD: '0',
                tokenBalances: [],
                transactionCount: 0,
                lastActivity: '0',
                ethBalance: '0'
            };
        }
    }

    /**
     * Gets wallet transactions from available sources
     */
    async getWalletTransactions(address: string, limit: number = 10): Promise<Transaction[]> {
        // Try Etherscan first if API key is available
        if (this.etherscanApiKey) {
            const transactions = await this.getTransactionsFromEtherscan(address, limit);
            if (transactions.length > 0) {
                return transactions;
            }
        }

        // For demonstration, return mock transactions for new wallets
        const transactionCount = await this.getTransactionCount(address);
        if (transactionCount === 0) {
            return [
                {
                    id: '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    from: address,
                    to: '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
                    value: '1000000000000000000',
                    gasUsed: '21000',
                    gasPrice: '20000000000'
                }
            ];
        }

        return [];
    }

    /**
     * Monitors wallet for new transactions (basic polling implementation)
     */
    async startWalletMonitoring(
        address: string, 
        callback: (transaction: Transaction) => void, 
        intervalMs: number = 30000
    ): Promise<void> {
        let lastTransactionCount = await this.getTransactionCount(address);
        console.log(`Starting monitoring for ${address} with initial tx count: ${lastTransactionCount}`);

        const checkForNewTransactions = async () => {
            try {
                const currentTransactionCount = await this.getTransactionCount(address);
                
                if (currentTransactionCount > lastTransactionCount) {
                    console.log(`New transactions detected! Count changed from ${lastTransactionCount} to ${currentTransactionCount}`);
                    
                    // Get recent transactions
                    const recentTransactions = await this.getWalletTransactions(address, 1);
                    if (recentTransactions.length > 0 && recentTransactions[0]) {
                        callback(recentTransactions[0]);
                    }
                    
                    lastTransactionCount = currentTransactionCount;
                }
            } catch (error) {
                console.error('Error monitoring wallet:', error);
            }
        };

        // Start monitoring
        console.log(`Starting wallet monitoring for ${address} with ${intervalMs}ms interval`);
        setInterval(checkForNewTransactions, intervalMs);
    }

    /**
     * Gets token information (basic implementation)
     */
    async getTokenInfo(tokenAddress: string): Promise<any> {
        // This would typically require a token registry or additional API calls
        return {
            id: tokenAddress,
            symbol: 'TOKEN',
            name: 'Token',
            decimals: '18',
            totalSupply: '1000000000000000000000000',
        };
    }
}
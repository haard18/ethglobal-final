import axios from 'axios';

// The Graph Protocol Token API endpoints (Updated for current working endpoints)
const GRAPH_API_ENDPOINT = 'https://gateway.thegraph.com/api/subgraphs/name/ethereum-blocks';

// Alternative endpoints for different networks - Updated to working endpoints
export const GRAPH_ENDPOINTS = {
    ethereum: 'https://gateway-arbitrum.network.thegraph.com/api/your-api-key/subgraphs/id/EYCKATKGBKLWvSfwvBjzfCBmGwYNdVkduYXVivCsLRFu', // ERC20 tokens
    // For testing, we'll use a simpler approach with basic Ethereum data
    etherscan: 'https://api.etherscan.io/api', // Fallback to Etherscan API
    blocks: 'https://gateway.thegraph.com/api/subgraphs/name/ethereum-blocks'
};

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

export class GraphProtocolService {
    private endpoint: string;

    constructor(network: keyof typeof GRAPH_ENDPOINTS = 'ethereum') {
        this.endpoint = GRAPH_ENDPOINTS[network];
    }

    /**
     * Executes a GraphQL query against The Graph Protocol
     */
    private async executeQuery(query: string, variables: any = {}): Promise<any> {
        try {
            const response = await axios.post(this.endpoint, {
                query,
                variables
            }, {
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.data.errors) {
                throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
            }

            return response.data.data;
        } catch (error) {
            console.error('Graph Protocol API error:', error);
            throw new Error(`Failed to execute Graph query: ${error}`);
        }
    }

    /**
     * Gets wallet token balances and basic information
     */
    async getWalletData(address: string): Promise<WalletData> {
        const query = `
            query GetWalletData($address: String!) {
                user(id: $address) {
                    id
                    liquidityPositions {
                        liquidityTokenBalance
                        pair {
                            token0 {
                                id
                                symbol
                                name
                                decimals
                            }
                            token1 {
                                id
                                symbol
                                name
                                decimals
                            }
                        }
                    }
                }
                transactions(
                    where: { from: $address }
                    orderBy: timestamp
                    orderDirection: desc
                    first: 10
                ) {
                    id
                    timestamp
                    from
                    to
                    value
                    gasUsed
                    gasPrice
                }
            }
        `;

        const variables = { address: address.toLowerCase() };
        const data = await this.executeQuery(query, variables);

        // Process the data
        const tokenBalances: TokenBalance[] = [];
        let totalValueUSD = '0';
        let transactionCount = 0;
        let lastActivity = '0';

        if (data.user) {
            // Process liquidity positions as token balances
            for (const position of data.user.liquidityPositions || []) {
                if (position.liquidityTokenBalance && parseFloat(position.liquidityTokenBalance) > 0) {
                    const pair = position.pair;
                    
                    // Add both tokens from the pair
                    if (pair.token0) {
                        tokenBalances.push({
                            token: {
                                id: pair.token0.id,
                                symbol: pair.token0.symbol,
                                name: pair.token0.name,
                                decimals: pair.token0.decimals
                            },
                            valueExact: position.liquidityTokenBalance,
                            valueUSD: '0' // Would need price data to calculate
                        });
                    }
                    
                    if (pair.token1) {
                        tokenBalances.push({
                            token: {
                                id: pair.token1.id,
                                symbol: pair.token1.symbol,
                                name: pair.token1.name,
                                decimals: pair.token1.decimals
                            },
                            valueExact: position.liquidityTokenBalance,
                            valueUSD: '0' // Would need price data to calculate
                        });
                    }
                }
            }
        }

        if (data.transactions) {
            transactionCount = data.transactions.length;
            if (data.transactions.length > 0) {
                lastActivity = data.transactions[0].timestamp;
            }
        }

        return {
            address,
            totalValueUSD,
            tokenBalances,
            transactionCount,
            lastActivity
        };
    }

    /**
     * Gets recent transactions for a wallet
     */
    async getWalletTransactions(address: string, limit: number = 10): Promise<Transaction[]> {
        const query = `
            query GetWalletTransactions($address: String!, $limit: Int!) {
                transactions(
                    where: { from: $address }
                    orderBy: timestamp
                    orderDirection: desc
                    first: $limit
                ) {
                    id
                    timestamp
                    from
                    to
                    value
                    gasUsed
                    gasPrice
                }
            }
        `;

        const variables = { address: address.toLowerCase(), limit };
        const data = await this.executeQuery(query, variables);

        return (data.transactions || []).map((tx: any) => ({
            id: tx.id,
            timestamp: tx.timestamp,
            from: tx.from,
            to: tx.to,
            value: tx.value,
            gasUsed: tx.gasUsed,
            gasPrice: tx.gasPrice
        }));
    }

    /**
     * Gets token information by address
     */
    async getTokenInfo(tokenAddress: string): Promise<any> {
        const query = `
            query GetTokenInfo($tokenAddress: String!) {
                token(id: $tokenAddress) {
                    id
                    symbol
                    name
                    decimals
                    totalSupply
                    tradeVolume
                    tradeVolumeUSD
                    untrackedVolumeUSD
                    txCount
                    totalLiquidity
                    derivedETH
                }
            }
        `;

        const variables = { tokenAddress: tokenAddress.toLowerCase() };
        const data = await this.executeQuery(query, variables);
        
        return data.token;
    }

    /**
     * Monitors wallet for new transactions (polling-based)
     */
    async startWalletMonitoring(address: string, callback: (transaction: Transaction) => void, intervalMs: number = 30000): Promise<void> {
        let lastTransactionId: string | null = null;
        
        // Get initial transaction
        const initialTransactions = await this.getWalletTransactions(address, 1);
        if (initialTransactions.length > 0 && initialTransactions[0]) {
            lastTransactionId = initialTransactions[0].id;
        }

        const checkForNewTransactions = async () => {
            try {
                const recentTransactions = await this.getWalletTransactions(address, 5);
                
                for (const tx of recentTransactions) {
                    if (tx.id !== lastTransactionId) {
                        callback(tx);
                        lastTransactionId = tx.id;
                        break; // Only process the most recent new transaction
                    } else {
                        break; // Stop when we reach a transaction we've already seen
                    }
                }
            } catch (error) {
                console.error('Error monitoring wallet:', error);
            }
        };

        // Start monitoring
        console.log(`Starting wallet monitoring for ${address} with ${intervalMs}ms interval`);
        setInterval(checkForNewTransactions, intervalMs);
    }
}
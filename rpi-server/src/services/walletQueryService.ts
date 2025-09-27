import { GraphProtocolService, type WalletData, type TokenBalance, type Transaction } from '../graph/market/walletmonitor.js';
import { PhysicalWalletService } from './physicalWallet.js';
import { speakText } from '../output/speak.js';
import { showDisplayMessage } from '../utils/display.js';

export interface WalletQueryResult {
    success: boolean;
    data?: any;
    message: string;
    spokenMessage: string;
    error?: string;
}

export interface TokenQueryParameters {
    symbol?: string;
    address?: string;
    minValue?: number;
}

export interface PortfolioSummary {
    totalValueUSD: number;
    ethBalance: string;
    tokenCount: number;
    topHoldings: Array<{
        symbol: string;
        name: string;
        valueUSD: number;
        portfolioPercentage: string;
    }>;
    diversificationRisk: 'Low' | 'Medium' | 'High';
    walletAddress: string;
}

/**
 * Service for handling complex wallet data queries and market information
 * Integrates with GPT to provide intelligent responses to user queries
 */
export class WalletQueryService {
    private graphProtocolService: GraphProtocolService;
    private physicalWalletService: PhysicalWalletService;

    constructor(physicalWalletService: PhysicalWalletService) {
        this.graphProtocolService = new GraphProtocolService();
        this.physicalWalletService = physicalWalletService;
    }

    /**
     * Get the main wallet or throw error if none exists
     */
    private getMainWallet() {
        const wallets = this.physicalWalletService.getAllWallets();
        if (wallets.length === 0) {
            throw new Error('No wallets found. Please create a wallet first.');
        }
        return wallets[0]; // Use first wallet as main wallet
    }

    /**
     * Get detailed wallet balance information
     */
    async getWalletBalance(walletAddress?: string): Promise<WalletQueryResult> {
        try {
            const wallet = walletAddress ? 
                this.physicalWalletService.getWallet(walletAddress) : 
                this.getMainWallet();

            if (!wallet) {
                return {
                    success: false,
                    message: "Wallet not found",
                    spokenMessage: "I couldn't find that wallet in your portfolio",
                    error: "Wallet not found"
                };
            }

            const walletData = await this.graphProtocolService.getWalletData(wallet.walletInfo.address);
            
            const message = `Your wallet balance is ${walletData.balance} ETH with a total portfolio value of $${walletData.totalValueUSD.toFixed(2)} USD across ${walletData.tokenBalances.length} tokens.`;
            const spokenMessage = `Your portfolio is worth ${walletData.totalValueUSD.toFixed(0)} dollars with ${walletData.balance} ETH and ${walletData.tokenBalances.length} total tokens.`;

            // Show balance on display
            try {
                await showDisplayMessage({
                    text: `Portfolio: $${walletData.totalValueUSD.toFixed(0)}\nETH: ${walletData.balance}\nTokens: ${walletData.tokenBalances.length}`,
                    emotion: 'normal',
                    duration: 8
                });
            } catch (displayError) {
                console.warn('Display error:', displayError);
            }

            return {
                success: true,
                message,
                spokenMessage,
                data: {
                    walletAddress: wallet.walletInfo.address,
                    ethBalance: walletData.balance,
                    totalValueUSD: walletData.totalValueUSD,
                    tokenCount: walletData.tokenBalances.length,
                    lastUpdated: new Date().toISOString()
                }
            };
        } catch (error) {
            // Show error on display
            try {
                await showDisplayMessage({
                    text: 'Balance Query Failed\nCheck connection',
                    emotion: 'confused',
                    duration: 6
                });
            } catch (displayError) {
                console.warn('Display error:', displayError);
            }
            
            return {
                success: false,
                message: "Failed to fetch wallet balance",
                spokenMessage: "Sorry, I couldn't fetch your wallet balance right now",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    /**
     * Get specific token price and holdings information
     */
    async getTokenPrice(tokenSymbol: string, walletAddress?: string): Promise<WalletQueryResult> {
        try {
            const wallet = walletAddress ? 
                this.physicalWalletService.getWallet(walletAddress) : 
                this.getMainWallet();

            if (!wallet) {
                return {
                    success: false,
                    message: "Wallet not found",
                    spokenMessage: "I couldn't find that wallet in your portfolio",
                    error: "Wallet not found"
                };
            }

            const walletData = await this.graphProtocolService.getWalletData(wallet.walletInfo.address);
            const token = walletData.tokenBalances.find(t => 
                t.symbol.toLowerCase() === tokenSymbol.toLowerCase() ||
                t.name.toLowerCase().includes(tokenSymbol.toLowerCase())
            );

            if (!token) {
                const availableTokens = walletData.tokenBalances
                    .filter(t => t.value > 0)
                    .map(t => t.symbol)
                    .slice(0, 5);

                return {
                    success: false,
                    message: `You don't have any ${tokenSymbol} tokens in your wallet. Available tokens: ${availableTokens.join(", ")}`,
                    spokenMessage: `You don't have any ${tokenSymbol} tokens. Your main tokens are ${availableTokens.slice(0, 3).join(", ")}`,
                    data: { availableTokens }
                };
            }

            const portfolioPercent = walletData.totalValueUSD > 0 ? 
                ((token.value / walletData.totalValueUSD) * 100).toFixed(2) : "0";
            
            const message = `Your ${token.symbol} (${token.name}) holding is worth $${token.value.toFixed(2)} USD, representing ${portfolioPercent}% of your portfolio. You have ${token.amount} ${token.symbol}.`;
            const spokenMessage = `Your ${token.symbol} is worth ${token.value.toFixed(0)} dollars, which is ${portfolioPercent} percent of your portfolio.`;

            return {
                success: true,
                message,
                spokenMessage,
                data: {
                    symbol: token.symbol,
                    name: token.name,
                    balance: token.amount,
                    valueUSD: token.value,
                    portfolioPercentage: portfolioPercent + "%",
                    contract: token.contract,
                    walletAddress: wallet.walletInfo.address
                }
            };
        } catch (error) {
            return {
                success: false,
                message: "Failed to fetch token price",
                spokenMessage: "Sorry, I couldn't get that token price right now",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    /**
     * Get comprehensive portfolio value breakdown
     */
    async getPortfolioValue(walletAddress?: string): Promise<WalletQueryResult> {
        try {
            const wallet = walletAddress ? 
                this.physicalWalletService.getWallet(walletAddress) : 
                this.getMainWallet();

            if (!wallet) {
                return {
                    success: false,
                    message: "Wallet not found",
                    spokenMessage: "I couldn't find that wallet in your portfolio",
                    error: "Wallet not found"
                };
            }

            const walletData = await this.graphProtocolService.getWalletData(wallet.walletInfo.address);
            const sortedTokens = walletData.tokenBalances
                .filter(token => token.value > 0)
                .sort((a, b) => b.value - a.value);

            const topHoldings = sortedTokens.slice(0, 5);
            const totalValue = walletData.totalValueUSD;

            // Calculate diversification risk
            const topTokenPercent = sortedTokens.length > 0 && sortedTokens[0] ? 
                (sortedTokens[0].value / totalValue) * 100 : 0;
            const diversificationRisk = topTokenPercent > 50 ? 'High' : 
                topTokenPercent > 25 ? 'Medium' : 'Low';

            let message = `Your total portfolio value is $${totalValue.toFixed(2)} USD across ${walletData.tokenBalances.length} tokens. `;
            message += `Risk level: ${diversificationRisk}. `;
            
            if (topHoldings.length > 0) {
                message += `Top holdings: ${topHoldings.map(token => 
                    `${token.symbol} ($${token.value.toFixed(2)})`
                ).join(", ")}`;
            }

            const spokenMessage = `Your portfolio is worth ${totalValue.toFixed(0)} dollars with ${diversificationRisk.toLowerCase()} risk. Your largest holding is ${topHoldings[0]?.symbol || 'ETH'} at ${topHoldings[0] ? topHoldings[0].value.toFixed(0) : '0'} dollars.`;

            // Show portfolio value on display
            try {
                const topToken = topHoldings[0];
                await showDisplayMessage({
                    text: `Portfolio: $${totalValue.toFixed(0)}\nRisk: ${diversificationRisk}\nTop: ${topToken ? `${topToken.symbol} $${topToken.value.toFixed(0)}` : 'N/A'}`,
                    emotion: diversificationRisk === 'High' ? 'confused' : diversificationRisk === 'Medium' ? 'normal' : 'happy',
                    duration: 10
                });
            } catch (displayError) {
                console.warn('Display error:', displayError);
            }

            return {
                success: true,
                message,
                spokenMessage,
                data: {
                    totalValueUSD: totalValue,
                    tokenCount: walletData.tokenBalances.length,
                    ethBalance: walletData.balance,
                    diversificationRisk,
                    topHoldings: topHoldings.map(token => ({
                        symbol: token.symbol,
                        name: token.name,
                        valueUSD: token.value,
                        portfolioPercentage: ((token.value / totalValue) * 100).toFixed(2) + "%"
                    })),
                    walletAddress: wallet.walletInfo.address
                }
            };
        } catch (error) {
            return {
                success: false,
                message: "Failed to fetch portfolio value",
                spokenMessage: "Sorry, I couldn't get your portfolio information right now",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    /**
     * Get all token holdings with filtering options
     */
    async getTokenHoldings(params: TokenQueryParameters = {}, walletAddress?: string): Promise<WalletQueryResult> {
        try {
            const wallet = walletAddress ? 
                this.physicalWalletService.getWallet(walletAddress) : 
                this.getMainWallet();

            if (!wallet) {
                return {
                    success: false,
                    message: "Wallet not found",
                    spokenMessage: "I couldn't find that wallet in your portfolio",
                    error: "Wallet not found"
                };
            }

            const walletData = await this.graphProtocolService.getWalletData(wallet.walletInfo.address);
            let filteredTokens = walletData.tokenBalances;

            // Apply filters
            if (params.minValue) {
                filteredTokens = filteredTokens.filter(token => token.value >= params.minValue!);
            }

            if (params.symbol) {
                const searchSymbol = params.symbol.toLowerCase();
                filteredTokens = filteredTokens.filter(token =>
                    token.symbol.toLowerCase().includes(searchSymbol) ||
                    token.name.toLowerCase().includes(searchSymbol)
                );
            }

            // Sort by value
            const tokenHoldings = filteredTokens
                .sort((a, b) => b.value - a.value)
                .map(token => ({
                    symbol: token.symbol,
                    name: token.name,
                    balance: token.amount,
                    valueUSD: token.value,
                    portfolioPercentage: walletData.totalValueUSD > 0 ? 
                        ((token.value / walletData.totalValueUSD) * 100).toFixed(2) + "%" : "0%"
                }));

            const tokensWithValue = tokenHoldings.filter(t => parseFloat(t.valueUSD.toString()) > 0);
            
            let message = `You hold ${tokenHoldings.length} different tokens`;
            if (params.minValue) {
                message += ` with minimum value $${params.minValue}`;
            }
            message += ` with a total value of $${walletData.totalValueUSD.toFixed(2)} USD.`;
            
            if (tokensWithValue.length > 0) {
                message += ` Top tokens: ${tokensWithValue.slice(0, 3).map(t => 
                    `${t.symbol} (${t.portfolioPercentage})`
                ).join(", ")}`;
            }

            const spokenMessage = `You hold ${tokensWithValue.length} tokens with value, totaling ${walletData.totalValueUSD.toFixed(0)} dollars.`;

            return {
                success: true,
                message,
                spokenMessage,
                data: {
                    totalTokens: tokenHoldings.length,
                    tokensWithValue: tokensWithValue.length,
                    totalValueUSD: walletData.totalValueUSD,
                    holdings: tokenHoldings,
                    walletAddress: wallet.walletInfo.address,
                    filters: params
                }
            };
        } catch (error) {
            return {
                success: false,
                message: "Failed to fetch token holdings",
                spokenMessage: "Sorry, I couldn't get your token holdings right now",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    /**
     * Get comprehensive wallet summary
     */
    async getWalletSummary(walletAddress?: string): Promise<WalletQueryResult> {
        try {
            const wallet = walletAddress ? 
                this.physicalWalletService.getWallet(walletAddress) : 
                this.getMainWallet();

            if (!wallet) {
                return {
                    success: false,
                    message: "Wallet not found",
                    spokenMessage: "I couldn't find that wallet in your portfolio",
                    error: "Wallet not found"
                };
            }

            const walletData = await this.graphProtocolService.getWalletData(wallet.walletInfo.address);
            const recentTransactions = await this.graphProtocolService.getWalletTransactions(
                wallet.walletInfo.address, 
                'mainnet', 
                3
            );
            
            const topTokens = walletData.tokenBalances
                .filter(token => token.value > 0)
                .sort((a, b) => b.value - a.value)
                .slice(0, 3);

            // Calculate activity level
            const activityLevel = recentTransactions.length > 2 ? 'High' : 
                recentTransactions.length > 0 ? 'Medium' : 'Low';

            const message = `Wallet Summary: $${walletData.totalValueUSD.toFixed(2)} USD total value, ${walletData.tokenBalances.length} tokens, ${recentTransactions.length} recent transactions (${activityLevel} activity). Top holdings: ${topTokens.map(t => `${t.symbol} ($${t.value.toFixed(2)})`).join(", ")}.`;
            
            const spokenMessage = `Your wallet summary: Total value ${walletData.totalValueUSD.toFixed(0)} dollars with ${walletData.tokenBalances.length} tokens and ${activityLevel.toLowerCase()} activity. Your top token is ${topTokens[0]?.symbol || 'none'}.`;

            // Show wallet summary on display
            try {
                await showDisplayMessage({
                    text: `Wallet Summary\n$${walletData.totalValueUSD.toFixed(0)} USD\n${walletData.tokenBalances.length} tokens, ${activityLevel} activity`,
                    emotion: activityLevel === 'High' ? 'excited' : activityLevel === 'Medium' ? 'happy' : 'normal',
                    duration: 10
                });
            } catch (displayError) {
                console.warn('Display error:', displayError);
            }

            return {
                success: true,
                message,
                spokenMessage,
                data: {
                    walletAddress: wallet.walletInfo.address,
                    totalValueUSD: walletData.totalValueUSD,
                    ethBalance: walletData.balance,
                    tokenCount: walletData.tokenBalances.length,
                    transactionCount: walletData.transactionCount,
                    activityLevel,
                    topHoldings: topTokens.map(token => ({
                        symbol: token.symbol,
                        name: token.name,
                        valueUSD: token.value,
                        portfolioPercentage: ((token.value / walletData.totalValueUSD) * 100).toFixed(2) + "%"
                    })),
                    recentTransactionCount: recentTransactions.length,
                    lastUpdate: new Date().toISOString()
                }
            };
        } catch (error) {
            return {
                success: false,
                message: "Failed to generate wallet summary",
                spokenMessage: "Sorry, I couldn't generate your wallet summary right now",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    /**
     * Search for tokens by symbol or name
     */
    async searchTokens(searchTerm: string, walletAddress?: string): Promise<WalletQueryResult> {
        try {
            const wallet = walletAddress ? 
                this.physicalWalletService.getWallet(walletAddress) : 
                this.getMainWallet();

            if (!wallet) {
                return {
                    success: false,
                    message: "Wallet not found",
                    spokenMessage: "I couldn't find that wallet in your portfolio",
                    error: "Wallet not found"
                };
            }

            const walletData = await this.graphProtocolService.getWalletData(wallet.walletInfo.address);
            const searchTermLower = searchTerm.toLowerCase();
            
            const matchingTokens = walletData.tokenBalances.filter(token =>
                token.symbol.toLowerCase().includes(searchTermLower) ||
                token.name.toLowerCase().includes(searchTermLower)
            );

            if (matchingTokens.length === 0) {
                return {
                    success: false,
                    message: `No tokens found matching "${searchTerm}"`,
                    spokenMessage: `I couldn't find any tokens matching ${searchTerm}`,
                    data: {
                        searchTerm,
                        suggestions: walletData.tokenBalances
                            .filter(t => t.value > 0)
                            .slice(0, 5)
                            .map(t => t.symbol)
                    }
                };
            }

            const sortedMatches = matchingTokens.sort((a, b) => b.value - a.value);
            const totalMatchValue = sortedMatches.reduce((sum, token) => sum + token.value, 0);

            const message = `Found ${matchingTokens.length} tokens matching "${searchTerm}" with total value $${totalMatchValue.toFixed(2)} USD: ${sortedMatches.map(t => `${t.symbol} ($${t.value.toFixed(2)})`).join(", ")}`;
            
            const spokenMessage = `Found ${matchingTokens.length} matching tokens worth ${totalMatchValue.toFixed(0)} dollars total.`;

            return {
                success: true,
                message,
                spokenMessage,
                data: {
                    searchTerm,
                    matchCount: matchingTokens.length,
                    totalValue: totalMatchValue,
                    matches: sortedMatches.map(token => ({
                        symbol: token.symbol,
                        name: token.name,
                        valueUSD: token.value,
                        balance: token.amount
                    })),
                    walletAddress: wallet.walletInfo.address
                }
            };
        } catch (error) {
            return {
                success: false,
                message: "Failed to search tokens",
                spokenMessage: "Sorry, I couldn't search your tokens right now",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    /**
     * Compare token values or get market insights
     */
    async getMarketInsights(walletAddress?: string): Promise<WalletQueryResult> {
        try {
            const wallet = walletAddress ? 
                this.physicalWalletService.getWallet(walletAddress) : 
                this.getMainWallet();

            if (!wallet) {
                return {
                    success: false,
                    message: "Wallet not found",
                    spokenMessage: "I couldn't find that wallet in your portfolio",
                    error: "Wallet not found"
                };
            }

            const walletData = await this.graphProtocolService.getWalletData(wallet.walletInfo.address);
            const sortedTokens = walletData.tokenBalances
                .filter(token => token.value > 0)
                .sort((a, b) => b.value - a.value);

            const insights = {
                portfolioConcentration: sortedTokens.length > 0 && sortedTokens[0] ? 
                    (sortedTokens[0].value / walletData.totalValueUSD) * 100 : 0,
                diversificationScore: sortedTokens.length,
                topPerformer: sortedTokens[0],
                smallHoldings: sortedTokens.filter(t => t.value < 10).length,
                totalValue: walletData.totalValueUSD
            };

            let riskLevel = 'Low';
            if (insights.portfolioConcentration > 60) riskLevel = 'Very High';
            else if (insights.portfolioConcentration > 40) riskLevel = 'High';
            else if (insights.portfolioConcentration > 25) riskLevel = 'Medium';

            const message = `Market Insights: Portfolio concentration is ${insights.portfolioConcentration.toFixed(1)}% (${riskLevel} risk). You have ${insights.diversificationScore} different tokens and ${insights.smallHoldings} small holdings under $10. Your largest position is ${insights.topPerformer?.symbol} at $${insights.topPerformer?.value.toFixed(2)}.`;

            const spokenMessage = `Your portfolio has ${riskLevel.toLowerCase()} risk with ${insights.diversificationScore} tokens. Your biggest holding is ${insights.topPerformer?.symbol} worth ${insights.topPerformer?.value.toFixed(0)} dollars.`;

            return {
                success: true,
                message,
                spokenMessage,
                data: {
                    portfolioConcentration: insights.portfolioConcentration,
                    riskLevel,
                    diversificationScore: insights.diversificationScore,
                    topPerformer: insights.topPerformer,
                    smallHoldingsCount: insights.smallHoldings,
                    totalValue: insights.totalValue,
                    walletAddress: wallet.walletInfo.address
                }
            };
        } catch (error) {
            return {
                success: false,
                message: "Failed to get market insights",
                spokenMessage: "Sorry, I couldn't analyze your portfolio right now",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    /**
     * Get comprehensive wallet activity with all transactions and interactions
     */
    async getWalletActivity(limit: number = 20, walletAddress?: string): Promise<WalletQueryResult> {
        try {
            const wallet = walletAddress ? 
                this.physicalWalletService.getWallet(walletAddress) : 
                this.getMainWallet();

            if (!wallet) {
                return {
                    success: false,
                    message: "Wallet not found",
                    spokenMessage: "I couldn't find that wallet in your portfolio",
                    error: "Wallet not found"
                };
            }

            // Fetch comprehensive transaction data
            const [walletData, recentTransactions] = await Promise.all([
                this.graphProtocolService.getWalletData(wallet.walletInfo.address),
                this.graphProtocolService.getWalletTransactions(wallet.walletInfo.address, 'mainnet', limit)
            ]);

            if (!recentTransactions || recentTransactions.length === 0) {
                return {
                    success: true,
                    message: "No recent activity found for your wallet",
                    spokenMessage: "Your wallet shows no recent transaction activity",
                    data: {
                        walletAddress: wallet.walletInfo.address,
                        totalTransactions: 0,
                        transactions: [],
                        activitySummary: {
                            totalValue: walletData.totalValueUSD,
                            transactionCount: 0,
                            lastActivity: null,
                            activityLevel: 'None'
                        }
                    }
                };
            }

            // Analyze transaction patterns
            const now = Date.now();
            const oneDayAgo = now - (24 * 60 * 60 * 1000);
            const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

            const recentActivity = recentTransactions.filter(tx => 
                tx.timestamp && (tx.timestamp * 1000) > oneDayAgo
            );

            const weeklyActivity = recentTransactions.filter(tx => 
                tx.timestamp && (tx.timestamp * 1000) > oneWeekAgo
            );

            // Calculate activity metrics
            const totalTransactionValue = recentTransactions.reduce((sum, tx) => sum + (tx.value || 0), 0);
            const uniqueTokens = [...new Set(recentTransactions.map(tx => tx.symbol))].filter(Boolean);
            const incomingTxs = recentTransactions.filter(tx => tx.to?.toLowerCase() === wallet.walletInfo.address.toLowerCase());
            const outgoingTxs = recentTransactions.filter(tx => tx.from?.toLowerCase() === wallet.walletInfo.address.toLowerCase());

            // Determine activity level
            let activityLevel = 'Low';
            if (recentActivity.length > 5) activityLevel = 'Very High';
            else if (recentActivity.length > 2) activityLevel = 'High';
            else if (weeklyActivity.length > 3) activityLevel = 'Medium';

            // Format transactions for display
            const formattedTransactions = recentTransactions.map(tx => {
                const isIncoming = tx.to?.toLowerCase() === wallet.walletInfo.address.toLowerCase();
                const transactionDate = tx.timestamp ? new Date(tx.timestamp * 1000) : new Date(tx.datetime || Date.now());
                
                return {
                    id: tx.transaction_id,
                    type: isIncoming ? 'Received' : 'Sent',
                    symbol: tx.symbol || 'ETH',
                    amount: tx.value?.toFixed(6) || '0',
                    valueUSD: tx.value || 0,
                    from: tx.from,
                    to: tx.to,
                    date: transactionDate.toISOString(),
                    timeAgo: this.formatTimeAgo(transactionDate),
                    blockNumber: tx.block_num,
                    isIncoming
                };
            });

            // Create comprehensive activity summary
            const activitySummary = {
                totalValue: walletData.totalValueUSD,
                transactionCount: recentTransactions.length,
                recentTransactions: recentActivity.length,
                weeklyTransactions: weeklyActivity.length,
                totalTransactionValue: totalTransactionValue,
                uniqueTokensTraded: uniqueTokens.length,
                incomingCount: incomingTxs.length,
                outgoingCount: outgoingTxs.length,
                lastActivity: recentTransactions[0] ? new Date(recentTransactions[0].timestamp * 1000 || recentTransactions[0].datetime || Date.now()).toISOString() : null,
                activityLevel,
                activeTokens: uniqueTokens.slice(0, 5)
            };

            // Create detailed message
            let message = `Wallet Activity Summary: ${recentTransactions.length} recent transactions `;
            message += `(${recentActivity.length} today, ${weeklyActivity.length} this week). `;
            message += `Activity level: ${activityLevel}. `;
            message += `Total transaction value: $${totalTransactionValue.toFixed(2)} across ${uniqueTokens.length} different tokens. `;
            message += `Balance: ${incomingTxs.length} incoming, ${outgoingTxs.length} outgoing transactions.`;

            const spokenMessage = `Your wallet shows ${activityLevel.toLowerCase()} activity with ${recentTransactions.length} recent transactions. ` +
                `You have ${recentActivity.length} transactions today and ${weeklyActivity.length} this week. ` +
                `Your most recent activity was ${recentTransactions[0] ? this.formatTimeAgo(new Date(recentTransactions[0].timestamp * 1000 || recentTransactions[0].datetime || Date.now())) : 'unknown'}.`;

            // Display activity on screen
            try {
                const displayText = `Activity: ${activityLevel}\n${recentTransactions.length} transactions\nLast: ${formattedTransactions[0]?.timeAgo || 'Unknown'}`;
                await showDisplayMessage({
                    text: displayText,
                    emotion: activityLevel === 'Very High' ? 'excited' : 
                            activityLevel === 'High' ? 'happy' :
                            activityLevel === 'Medium' ? 'normal' : 'confused',
                    duration: 12
                });
            } catch (displayError) {
                console.warn('Display error:', displayError);
            }

            // Speak the activity summary
            try {
                await speakText(spokenMessage);
            } catch (speechError) {
                console.warn('Speech error:', speechError);
            }

            return {
                success: true,
                message,
                spokenMessage,
                data: {
                    walletAddress: wallet.walletInfo.address,
                    totalTransactions: recentTransactions.length,
                    transactions: formattedTransactions,
                    activitySummary,
                    interactiveData: {
                        canShowMore: recentTransactions.length >= limit,
                        availableFilters: ['incoming', 'outgoing', 'by_token', 'by_date'],
                        supportedCommands: [
                            'show more transactions',
                            'filter by token',
                            'show only incoming',
                            'show only outgoing',
                            'show recent activity'
                        ]
                    }
                }
            };

        } catch (error) {
            // Show error on display
            try {
                await showDisplayMessage({
                    text: 'Activity Query Failed\nCheck connection',
                    emotion: 'confused',
                    duration: 6
                });
            } catch (displayError) {
                console.warn('Display error:', displayError);
            }

            return {
                success: false,
                message: "Failed to fetch wallet activity",
                spokenMessage: "Sorry, I couldn't fetch your wallet activity right now",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    /**
     * Get filtered wallet activity based on criteria
     */
    async getFilteredWalletActivity(
        filter: 'incoming' | 'outgoing' | 'recent' | string, 
        limit: number = 10,
        walletAddress?: string
    ): Promise<WalletQueryResult> {
        try {
            const wallet = walletAddress ? 
                this.physicalWalletService.getWallet(walletAddress) : 
                this.getMainWallet();

            if (!wallet) {
                return {
                    success: false,
                    message: "Wallet not found",
                    spokenMessage: "I couldn't find that wallet in your portfolio",
                    error: "Wallet not found"
                };
            }

            const allTransactions = await this.graphProtocolService.getWalletTransactions(
                wallet.walletInfo.address, 
                'mainnet', 
                50 // Get more to filter from
            );

            let filteredTransactions = allTransactions;
            let filterDescription = '';

            // Apply filters
            switch (filter.toLowerCase()) {
                case 'incoming':
                    filteredTransactions = allTransactions.filter(tx => 
                        tx.to?.toLowerCase() === wallet.walletInfo.address.toLowerCase()
                    );
                    filterDescription = 'incoming';
                    break;
                
                case 'outgoing':
                    filteredTransactions = allTransactions.filter(tx => 
                        tx.from?.toLowerCase() === wallet.walletInfo.address.toLowerCase()
                    );
                    filterDescription = 'outgoing';
                    break;
                
                case 'recent':
                    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
                    filteredTransactions = allTransactions.filter(tx => 
                        tx.timestamp && (tx.timestamp * 1000) > oneDayAgo
                    );
                    filterDescription = 'recent (last 24 hours)';
                    break;
                
                default:
                    // Filter by token symbol
                    filteredTransactions = allTransactions.filter(tx => 
                        tx.symbol?.toLowerCase().includes(filter.toLowerCase())
                    );
                    filterDescription = `${filter} token transactions`;
                    break;
            }

            // Limit results
            filteredTransactions = filteredTransactions.slice(0, limit);

            // Format transactions
            const formattedTransactions = filteredTransactions.map(tx => {
                const isIncoming = tx.to?.toLowerCase() === wallet.walletInfo.address.toLowerCase();
                const transactionDate = tx.timestamp ? new Date(tx.timestamp * 1000) : new Date(tx.datetime || Date.now());
                
                return {
                    id: tx.transaction_id,
                    type: isIncoming ? 'Received' : 'Sent',
                    symbol: tx.symbol || 'ETH',
                    amount: tx.value?.toFixed(6) || '0',
                    valueUSD: tx.value || 0,
                    from: tx.from,
                    to: tx.to,
                    date: transactionDate.toISOString(),
                    timeAgo: this.formatTimeAgo(transactionDate),
                    blockNumber: tx.block_num,
                    isIncoming
                };
            });

            const totalValue = filteredTransactions.reduce((sum, tx) => sum + (tx.value || 0), 0);

            const message = `Found ${filteredTransactions.length} ${filterDescription} transactions with total value $${totalValue.toFixed(2)} USD.`;
            const spokenMessage = `Showing ${filteredTransactions.length} ${filterDescription} transactions worth ${totalValue.toFixed(0)} dollars.`;

            return {
                success: true,
                message,
                spokenMessage,
                data: {
                    walletAddress: wallet.walletInfo.address,
                    filter: filterDescription,
                    totalTransactions: filteredTransactions.length,
                    totalValue,
                    transactions: formattedTransactions,
                    hasMore: allTransactions.length > filteredTransactions.length
                }
            };

        } catch (error) {
            return {
                success: false,
                message: "Failed to fetch filtered wallet activity",
                spokenMessage: "Sorry, I couldn't filter your wallet activity right now",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    /**
     * Helper method to format time ago
     */
    private formatTimeAgo(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) return 'just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
}
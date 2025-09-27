/**
 * Market Data Service for Pluto RPI Server
 * Handles communication with the substream market data server
 */

import axios, { type AxiosResponse } from 'axios';

export interface MarketDataConfig {
    baseUrl: string;
    requestTimeout: number;
    maxRetries: number;
}

export interface PumpfunEvent {
    id: number;
    event_type: string;
    block_number: number;
    block_hash: string;
    transaction_hash: string;
    log_index: number;
    token_address: string;
    user_address: string;
    amount: string;
    sol_amount: string;
    timestamp: string;
    metadata?: any;
    created_at: string;
}

export interface TokenStats {
    token_address: string;
    total_trades: number;
    unique_traders: number;
    total_buy_amount: string;
    total_sell_amount: string;
    total_volume_sol: string;
    first_trade_time: string;
    last_trade_time: string;
    price_change_24h?: number;
    volume_change_24h?: number;
}

export interface MarketToken {
    address: string;
    symbol: string;
    name: string;
    price: number;
    volume_24h: number;
    price_change_24h: number;
    market_cap?: number;
}

export class MarketDataService {
    private config: MarketDataConfig;

    constructor() {
        this.config = {
            baseUrl: 'https://substream-server.onrender.com',
            requestTimeout: 10000,
            maxRetries: 3
        };
    }

    private async makeRequest<T>(
        method: 'GET' | 'POST',
        endpoint: string,
        params?: any,
        data?: any
    ): Promise<T | null> {
        const url = `${this.config.baseUrl}${endpoint}`;

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                let response: AxiosResponse<T>;

                if (method === 'GET') {
                    response = await axios.get(url, {
                        params,
                        timeout: this.config.requestTimeout
                    });
                } else {
                    response = await axios.post(url, data, {
                        timeout: this.config.requestTimeout
                    });
                }

                if (response.status === 200) {
                    return response.data;
                }

                console.warn(`Market API request failed with status: ${response.status}`);
                
            } catch (error: any) {
                console.error(`Market API attempt ${attempt} failed:`, error.message);
                
                if (attempt < this.config.maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }

        return null;
    }

    private async makeRpcRequest<T>(method: string, params: any): Promise<T | null> {
        const rpcPayload = {
            jsonrpc: '2.0',
            method,
            params,
            id: Date.now()
        };

        try {
            const response = await this.makeRequest<{ result: T }>('POST', '/api/rpc', {}, rpcPayload);
            return response?.result || null;
        } catch (error) {
            console.error(`RPC request failed for method ${method}:`, error);
            return null;
        }
    }

    // Health Check
    async checkHealth(): Promise<boolean> {
        try {
            const response = await this.makeRequest<any>('GET', '/health');
            return response !== null;
        } catch {
            return false;
        }
    }

    // Pumpfun API Methods
    async getTokenEvents(tokenAddress: string, limit: number = 100): Promise<{ events: PumpfunEvent[], stats?: TokenStats } | null> {
        return this.makeRequest<{ events: PumpfunEvent[], stats?: TokenStats }>(
            'GET', 
            `/api/pumpfun/token/${tokenAddress}/events`,
            { limit }
        );
    }

    async getUserEvents(userAddress: string, limit: number = 100): Promise<{ events: PumpfunEvent[], stats?: any } | null> {
        return this.makeRequest<{ events: PumpfunEvent[], stats?: any }>(
            'GET',
            `/api/pumpfun/user/${userAddress}/events`,
            { limit }
        );
    }

    async getRecentEvents(limit: number = 100, eventType?: string): Promise<{ events: PumpfunEvent[] } | null> {
        const params: any = { limit };
        if (eventType) params.type = eventType;
        
        return this.makeRequest<{ events: PumpfunEvent[] }>(
            'GET',
            '/api/pumpfun/events/recent',
            params
        );
    }

    async getTokenStats(tokenAddress: string): Promise<TokenStats | null> {
        return this.makeRequest<TokenStats>(
            'GET',
            `/api/pumpfun/token/${tokenAddress}/stats`
        );
    }

    // Market Data Methods (inferred endpoints)
    async getMarketTokens(): Promise<{ tokens: MarketToken[] } | null> {
        return this.makeRequest<{ tokens: MarketToken[] }>('GET', '/api/market/tokens');
    }

    async getTokenInfo(tokenAddress: string): Promise<MarketToken | null> {
        return this.makeRequest<MarketToken>('GET', `/api/market/tokens/${tokenAddress}`);
    }

    async getTokenPrice(tokenAddress: string): Promise<{ price: number, change_24h?: number } | null> {
        return this.makeRequest<{ price: number, change_24h?: number }>(
            'GET',
            `/api/market/tokens/${tokenAddress}/price`
        );
    }

    async getTokenVolume(tokenAddress: string): Promise<{ volume_24h: number, change_24h?: number } | null> {
        return this.makeRequest<{ volume_24h: number, change_24h?: number }>(
            'GET',
            `/api/market/tokens/${tokenAddress}/volume`
        );
    }

    async getTokenTrades(tokenAddress: string): Promise<{ trades: any[] } | null> {
        return this.makeRequest<{ trades: any[] }>(
            'GET',
            `/api/market/tokens/${tokenAddress}/trades`
        );
    }

    async getMarketStats(): Promise<{ total_volume: number, total_tokens: number, active_traders: number } | null> {
        return this.makeRequest<{ total_volume: number, total_tokens: number, active_traders: number }>(
            'GET',
            '/api/market/stats'
        );
    }

    async getTopGainers(limit: number = 10): Promise<{ tokens: MarketToken[] } | null> {
        return this.makeRequest<{ tokens: MarketToken[] }>(
            'GET',
            '/api/market/top-gainers',
            { limit }
        );
    }

    async getTopLosers(limit: number = 10): Promise<{ tokens: MarketToken[] } | null> {
        return this.makeRequest<{ tokens: MarketToken[] }>(
            'GET',
            '/api/market/top-losers',
            { limit }
        );
    }

    async getTrendingTokens(limit: number = 10): Promise<{ tokens: MarketToken[] } | null> {
        return this.makeRequest<{ tokens: MarketToken[] }>(
            'GET',
            '/api/market/trending',
            { limit }
        );
    }

    // RPC Methods
    async getPumpfunEventsRpc(tokenAddress: string, limit: number = 100): Promise<{ events: PumpfunEvent[], stats?: TokenStats } | null> {
        return this.makeRpcRequest('getPumpfunEvents', {
            tokenAddress,
            limit
        });
    }

    async getUserEventsRpc(userAddress: string, limit: number = 100): Promise<{ events: PumpfunEvent[], stats?: any } | null> {
        return this.makeRpcRequest('getPumpfunUserEvents', {
            userAddress,
            limit
        });
    }

    async getMarketDataRpc(tokenAddress: string): Promise<MarketToken | null> {
        return this.makeRpcRequest('getMarketData', {
            tokenAddress
        });
    }

    async getTokenPriceRpc(tokenAddress: string): Promise<{ price: number, change_24h?: number } | null> {
        return this.makeRpcRequest('getTokenPrice', {
            tokenAddress
        });
    }

    // Helper Methods for Voice Assistant
    async getTokenSummary(tokenAddress: string): Promise<string> {
        try {
            const stats = await this.getTokenStats(tokenAddress);
            
            if (!stats) {
                return `Unable to get information for token ${tokenAddress.slice(0, 8)}...`;
            }

            const totalTrades = stats.total_trades || 0;
            const uniqueTraders = stats.unique_traders || 0;
            const volumeSol = parseFloat(stats.total_volume_sol || '0') / 1e9; // Convert to SOL
            
            let summary = `Token ${tokenAddress.slice(0, 8)}... has `;
            summary += `${totalTrades} total trades, `;
            summary += `${uniqueTraders} unique traders, `;
            summary += `and ${volumeSol.toFixed(2)} SOL in total volume`;

            if (stats.price_change_24h !== undefined) {
                const change = stats.price_change_24h > 0 ? 'up' : 'down';
                summary += `. Price is ${change} ${Math.abs(stats.price_change_24h).toFixed(2)}% in 24 hours`;
            }

            return summary;
        } catch (error) {
            console.error('Error getting token summary:', error);
            return `Error retrieving token information`;
        }
    }

    async getRecentMarketActivity(limit: number = 5): Promise<string> {
        try {
            const data = await this.getRecentEvents(limit);
            
            if (!data || !data.events || data.events.length === 0) {
                return "No recent market activity available";
            }

            const events = data.events;
            const buyCount = events.filter(e => e.event_type === 'buy').length;
            const sellCount = events.filter(e => e.event_type === 'sell').length;
            const createCount = events.filter(e => e.event_type === 'create').length;

            let summary = `Recent market activity shows ${events.length} events: `;
            
            const activities = [];
            if (buyCount > 0) activities.push(`${buyCount} buy orders`);
            if (sellCount > 0) activities.push(`${sellCount} sell orders`);
            if (createCount > 0) activities.push(`${createCount} new tokens created`);

            summary += activities.join(', ');
            
            return summary;
        } catch (error) {
            console.error('Error getting recent market activity:', error);
            return "Error retrieving market activity";
        }
    }

    async getUserTradingSummary(userAddress: string): Promise<string> {
        try {
            const data = await this.getUserEvents(userAddress, 50);
            
            if (!data || !data.events || data.events.length === 0) {
                return `No trading activity found for user ${userAddress.slice(0, 8)}...`;
            }

            const events = data.events;
            const buyCount = events.filter(e => e.event_type === 'buy').length;
            const sellCount = events.filter(e => e.event_type === 'sell').length;
            
            let summary = `User ${userAddress.slice(0, 8)}... has ${events.length} total transactions: `;
            summary += `${buyCount} buys and ${sellCount} sells`;

            // Calculate total volume if available
            const totalVolume = events.reduce((sum, event) => {
                const solAmount = parseFloat(event.sol_amount || '0');
                return sum + solAmount;
            }, 0) / 1e9; // Convert to SOL

            if (totalVolume > 0) {
                summary += ` with ${totalVolume.toFixed(2)} SOL total volume`;
            }

            return summary;
        } catch (error) {
            console.error('Error getting user trading summary:', error);
            return "Error retrieving user trading information";
        }
    }

    async getMarketOverview(): Promise<string> {
        try {
            const [marketStats, topGainers, recentActivity] = await Promise.all([
                this.getMarketStats(),
                this.getTopGainers(3),
                this.getRecentEvents(10)
            ]);

            let overview = "Current market overview: ";

            if (marketStats) {
                overview += `${marketStats.total_tokens} tokens tracked, `;
                overview += `${marketStats.active_traders} active traders, `;
                overview += `${(marketStats.total_volume / 1e9).toFixed(2)} SOL total volume. `;
            }

            if (topGainers?.tokens && topGainers.tokens.length > 0) {
                const topGainer = topGainers.tokens[0];
                if (topGainer) {
                    overview += `Top gainer: ${topGainer.symbol} up ${topGainer.price_change_24h?.toFixed(2)}%. `;
                }
            }

            if (recentActivity?.events && recentActivity.events.length > 0) {
                const recentCount = recentActivity.events.length;
                overview += `${recentCount} recent transactions in the last period.`;
            }

            return overview;
        } catch (error) {
            console.error('Error getting market overview:', error);
            return "Market data temporarily unavailable";
        }
    }

    // Price comparison and historical data helper
    async getPriceComparison(tokenAddress: string, period: string = '24h'): Promise<string> {
        try {
            const tokenInfo = await this.getTokenInfo(tokenAddress);
            
            if (!tokenInfo) {
                return `Unable to get price information for token ${tokenAddress.slice(0, 8)}...`;
            }

            let comparison = `Current price for ${tokenInfo.symbol}: $${tokenInfo.price.toFixed(6)}`;
            
            if (tokenInfo.price_change_24h !== undefined) {
                const change = tokenInfo.price_change_24h;
                const direction = change >= 0 ? 'up' : 'down';
                const percentage = Math.abs(change).toFixed(2);
                
                comparison += `. Over the last 24 hours, it's ${direction} ${percentage}%`;
                
                if (change > 10) {
                    comparison += " - significant gain!";
                } else if (change < -10) {
                    comparison += " - notable decline";
                }
            }

            return comparison;
        } catch (error) {
            console.error('Error getting price comparison:', error);
            return "Error retrieving price comparison";
        }
    }
}

// Export singleton instance
export const marketDataService = new MarketDataService();
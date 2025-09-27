/**
 * Market Command Router for Pluto RPI Server
 * Handles market data related voice commands and queries
 */

import { marketDataService, type MarketToken } from './marketDataService.js';
import { type ConversationContext, conversationManager } from './conversationManager.js';

export interface MarketCommandResult {
    success: boolean;
    response: string;
    data?: any;
    requiresConfirmation?: boolean;
    followUpAction?: string;
}

export class MarketCommandRouter {
    private tokenAddressRegex = /0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}/; // ETH and Solana addresses
    private solanaAddressRegex = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

    constructor() {
        // Initialize market data service connection check
        this.checkMarketDataConnection();
    }

    private async checkMarketDataConnection(): Promise<void> {
        try {
            const isHealthy = await marketDataService.checkHealth();
            if (isHealthy) {
                console.log('✅ Market data service connection established');
            } else {
                console.warn('⚠️ Market data service not accessible');
            }
        } catch (error) {
            console.error('❌ Market data service connection failed:', error);
        }
    }

    async processMarketCommand(
        command: string, 
        context: ConversationContext
    ): Promise<MarketCommandResult> {
        const normalizedCommand = command.toLowerCase().trim();
        
        console.log(`🔍 Processing market command: "${command}"`);

        try {
            // Market overview and general stats
            if (this.isMarketOverviewCommand(normalizedCommand)) {
                return await this.handleMarketOverview(context);
            }

            // Token price queries
            if (this.isPriceCommand(normalizedCommand)) {
                return await this.handlePriceQuery(normalizedCommand, context);
            }

            // Token statistics
            if (this.isTokenStatsCommand(normalizedCommand)) {
                return await this.handleTokenStats(normalizedCommand, context);
            }

            // Recent market activity
            if (this.isRecentActivityCommand(normalizedCommand)) {
                return await this.handleRecentActivity(normalizedCommand, context);
            }

            // User trading activity
            if (this.isUserActivityCommand(normalizedCommand)) {
                return await this.handleUserActivity(normalizedCommand, context);
            }

            // Top gainers/losers
            if (this.isTopTokensCommand(normalizedCommand)) {
                return await this.handleTopTokens(normalizedCommand, context);
            }

            // Price comparison and historical data
            if (this.isPriceComparisonCommand(normalizedCommand)) {
                return await this.handlePriceComparison(normalizedCommand, context);
            }

            // Trending tokens
            if (this.isTrendingCommand(normalizedCommand)) {
                return await this.handleTrending(context);
            }

            // Token events and trading history
            if (this.isTokenEventsCommand(normalizedCommand)) {
                return await this.handleTokenEvents(normalizedCommand, context);
            }

            return {
                success: false,
                response: "I didn't understand that market-related command. Try asking about token prices, market overview, or recent activity."
            };

        } catch (error) {
            console.error('Error processing market command:', error);
            return {
                success: false,
                response: "Sorry, I encountered an error while fetching market data. Please try again."
            };
        }
    }

    // Command detection methods
    private isMarketOverviewCommand(command: string): boolean {
        const patterns = [
            /market\s+overview/,
            /market\s+summary/,
            /market\s+status/,
            /how\s+is\s+the\s+market/,
            /market\s+stats/,
            /overall\s+market/
        ];
        return patterns.some(pattern => pattern.test(command));
    }

    private isPriceCommand(command: string): boolean {
        const patterns = [
            /price\s+of/,
            /what\s+is\s+the\s+price/,
            /current\s+price/,
            /token\s+price/,
            /how\s+much\s+is/
        ];
        return patterns.some(pattern => pattern.test(command));
    }

    private isTokenStatsCommand(command: string): boolean {
        const patterns = [
            /token\s+stats/,
            /token\s+statistics/,
            /token\s+info/,
            /token\s+summary/,
            /trading\s+stats/,
            /volume\s+for/
        ];
        return patterns.some(pattern => pattern.test(command));
    }

    private isRecentActivityCommand(command: string): boolean {
        const patterns = [
            /recent\s+activity/,
            /latest\s+trades/,
            /recent\s+trades/,
            /market\s+activity/,
            /what\s+is\s+happening/,
            /latest\s+transactions/
        ];
        return patterns.some(pattern => pattern.test(command));
    }

    private isUserActivityCommand(command: string): boolean {
        const patterns = [
            /user\s+activity/,
            /trading\s+activity\s+for/,
            /user\s+trades/,
            /account\s+activity/,
            /wallet\s+activity/
        ];
        return patterns.some(pattern => pattern.test(command));
    }

    private isTopTokensCommand(command: string): boolean {
        const patterns = [
            /top\s+gainers/,
            /top\s+losers/,
            /best\s+performing/,
            /worst\s+performing/,
            /biggest\s+gainers/,
            /biggest\s+losers/
        ];
        return patterns.some(pattern => pattern.test(command));
    }

    private isPriceComparisonCommand(command: string): boolean {
        const patterns = [
            /price\s+change/,
            /price\s+difference/,
            /price\s+over/,
            /price\s+in\s+last/,
            /compared\s+to/,
            /24\s+hours?\s+ago/,
            /last\s+\d+\s+days?/
        ];
        return patterns.some(pattern => pattern.test(command));
    }

    private isTrendingCommand(command: string): boolean {
        const patterns = [
            /trending\s+tokens/,
            /trending\s+coins/,
            /hot\s+tokens/,
            /popular\s+tokens/,
            /what\s+is\s+trending/
        ];
        return patterns.some(pattern => pattern.test(command));
    }

    private isTokenEventsCommand(command: string): boolean {
        const patterns = [
            /token\s+events/,
            /trading\s+events/,
            /token\s+trades/,
            /trade\s+history/,
            /transaction\s+history\s+for\s+token/
        ];
        return patterns.some(pattern => pattern.test(command));
    }

    // Command handlers
    private async handleMarketOverview(context: ConversationContext): Promise<MarketCommandResult> {
        const overview = await marketDataService.getMarketOverview();
        
        context.currentTopic = 'market-overview';
        conversationManager.addInteraction(context.sessionId, 'user', 'market overview request');
        conversationManager.addInteraction(context.sessionId, 'assistant', overview);

        return {
            success: true,
            response: overview,
            data: { topic: 'market-overview' }
        };
    }

    private async handlePriceQuery(command: string, context: ConversationContext): Promise<MarketCommandResult> {
        const tokenAddress = this.extractTokenAddress(command);
        
        if (!tokenAddress) {
            return {
                success: false,
                response: "Please provide a token address to check the price. For example, 'what is the price of 0x1234...'"
            };
        }

        const priceComparison = await marketDataService.getPriceComparison(tokenAddress);
        
        context.currentTopic = 'token-price';
        context.lastQueriedToken = tokenAddress;
        conversationManager.addInteraction(context.sessionId, 'user', `price query for ${tokenAddress}`);
        conversationManager.addInteraction(context.sessionId, 'assistant', priceComparison);

        return {
            success: true,
            response: priceComparison,
            data: { tokenAddress, topic: 'price' }
        };
    }

    private async handleTokenStats(command: string, context: ConversationContext): Promise<MarketCommandResult> {
        const tokenAddress = this.extractTokenAddress(command);
        
        if (!tokenAddress) {
            return {
                success: false,
                response: "Please provide a token address to get statistics. For example, 'token stats for 0x1234...'"
            };
        }

        const tokenSummary = await marketDataService.getTokenSummary(tokenAddress);
        
        context.currentTopic = 'token-stats';
        context.lastQueriedToken = tokenAddress;
        conversationManager.addInteraction(context.sessionId, 'user', `stats query for ${tokenAddress}`);
        conversationManager.addInteraction(context.sessionId, 'assistant', tokenSummary);

        return {
            success: true,
            response: tokenSummary,
            data: { tokenAddress, topic: 'stats' }
        };
    }

    private async handleRecentActivity(command: string, context: ConversationContext): Promise<MarketCommandResult> {
        // Extract limit if specified
        const limitMatch = command.match(/(\d+)/);
        const limit = limitMatch && limitMatch[1] ? parseInt(limitMatch[1]) : 10;

        const activity = await marketDataService.getRecentMarketActivity(Math.min(limit, 50));
        
        context.currentTopic = 'recent-activity';
        conversationManager.addInteraction(context.sessionId, 'user', 'recent activity request');
        conversationManager.addInteraction(context.sessionId, 'assistant', activity);

        return {
            success: true,
            response: activity,
            data: { limit, topic: 'activity' }
        };
    }

    private async handleUserActivity(command: string, context: ConversationContext): Promise<MarketCommandResult> {
        const userAddress = this.extractAddress(command);
        
        if (!userAddress) {
            return {
                success: false,
                response: "Please provide a user address to check trading activity. For example, 'user activity for 0x1234...'"
            };
        }

        const userSummary = await marketDataService.getUserTradingSummary(userAddress);
        
        context.currentTopic = 'user-activity';
        context.lastQueriedAddress = userAddress;
        conversationManager.addInteraction(context.sessionId, 'user', `user activity for ${userAddress}`);
        conversationManager.addInteraction(context.sessionId, 'assistant', userSummary);

        return {
            success: true,
            response: userSummary,
            data: { userAddress, topic: 'user-activity' }
        };
    }

    private async handleTopTokens(command: string, context: ConversationContext): Promise<MarketCommandResult> {
        const isGainers = /gainer|best|top/i.test(command);
        const limit = 5;

        let response: string;
        let topTokens;

        if (isGainers) {
            topTokens = await marketDataService.getTopGainers(limit);
            response = "Top gaining tokens: ";
        } else {
            topTokens = await marketDataService.getTopLosers(limit);
            response = "Top losing tokens: ";
        }

        if (topTokens?.tokens && topTokens.tokens.length > 0) {
            const tokenList = topTokens.tokens.map((token: MarketToken, index: number) => {
                const change = token.price_change_24h?.toFixed(2) || 'N/A';
                return `${index + 1}. ${token.symbol}: ${change}%`;
            }).join(', ');
            
            response += tokenList;
        } else {
            response += "Data currently unavailable";
        }

        context.currentTopic = isGainers ? 'top-gainers' : 'top-losers';
        conversationManager.addInteraction(context.sessionId, 'user', command);
        conversationManager.addInteraction(context.sessionId, 'assistant', response);

        return {
            success: true,
            response,
            data: { tokens: topTokens?.tokens, type: isGainers ? 'gainers' : 'losers' }
        };
    }

    private async handlePriceComparison(command: string, context: ConversationContext): Promise<MarketCommandResult> {
        const tokenAddress = this.extractTokenAddress(command) || context.lastQueriedToken;
        
        if (!tokenAddress) {
            return {
                success: false,
                response: "Please specify a token address for price comparison, or ask about a specific token first."
            };
        }

        // Extract time period if mentioned
        const period = this.extractTimePeriod(command);
        const comparison = await marketDataService.getPriceComparison(tokenAddress, period);

        context.currentTopic = 'price-comparison';
        context.lastQueriedToken = tokenAddress;
        conversationManager.addInteraction(context.sessionId, 'user', `price comparison for ${tokenAddress}`);
        conversationManager.addInteraction(context.sessionId, 'assistant', comparison);

        return {
            success: true,
            response: comparison,
            data: { tokenAddress, period, topic: 'price-comparison' }
        };
    }

    private async handleTrending(context: ConversationContext): Promise<MarketCommandResult> {
        const trending = await marketDataService.getTrendingTokens(5);
        
        let response = "Trending tokens: ";
        
        if (trending?.tokens && trending.tokens.length > 0) {
            const tokenList = trending.tokens.map((token: MarketToken, index: number) => {
                return `${index + 1}. ${token.symbol} (${token.price_change_24h?.toFixed(2)}%)`;
            }).join(', ');
            
            response += tokenList;
        } else {
            response += "Data currently unavailable";
        }

        context.currentTopic = 'trending';
        conversationManager.addInteraction(context.sessionId, 'user', 'trending tokens request');
        conversationManager.addInteraction(context.sessionId, 'assistant', response);

        return {
            success: true,
            response,
            data: { tokens: trending?.tokens, topic: 'trending' }
        };
    }

    private async handleTokenEvents(command: string, context: ConversationContext): Promise<MarketCommandResult> {
        const tokenAddress = this.extractTokenAddress(command);
        
        if (!tokenAddress) {
            return {
                success: false,
                response: "Please provide a token address to get trading events. For example, 'token events for 0x1234...'"
            };
        }

        const limit = 10;
        const eventsData = await marketDataService.getTokenEvents(tokenAddress, limit);
        
        let response = `Recent events for token ${tokenAddress.slice(0, 8)}...: `;
        
        if (eventsData?.events && eventsData.events.length > 0) {
            const eventSummary = eventsData.events.slice(0, 5).map((event: any) => {
                const amount = parseFloat(event.sol_amount) / 1e9;
                return `${event.event_type} ${amount.toFixed(3)} SOL`;
            }).join(', ');
            
            response += `${eventsData.events.length} events found. Latest: ${eventSummary}`;
        } else {
            response += "No recent events found";
        }

        context.currentTopic = 'token-events';
        context.lastQueriedToken = tokenAddress;
        conversationManager.addInteraction(context.sessionId, 'user', `token events for ${tokenAddress}`);
        conversationManager.addInteraction(context.sessionId, 'assistant', response);

        return {
            success: true,
            response,
            data: { tokenAddress, events: eventsData?.events, topic: 'events' }
        };
    }

    // Utility methods
    private extractTokenAddress(command: string): string | null {
        const match = command.match(this.tokenAddressRegex);
        return match ? match[0] : null;
    }

    private extractAddress(command: string): string | null {
        return this.extractTokenAddress(command);
    }

    private extractTimePeriod(command: string): string {
        if (command.includes('24 hour') || command.includes('day')) return '24h';
        if (command.includes('week') || command.includes('7 day')) return '7d';
        if (command.includes('month') || command.includes('30 day')) return '30d';
        return '24h'; // default
    }

    // Helper method to determine if a command is market-related
    static isMarketCommand(command: string): boolean {
        const marketKeywords = [
            'price', 'market', 'token', 'trading', 'volume', 'stats',
            'gainer', 'loser', 'trending', 'activity', 'events',
            'comparison', 'change', 'overview', 'summary'
        ];

        const normalizedCommand = command.toLowerCase();
        return marketKeywords.some(keyword => normalizedCommand.includes(keyword));
    }
}
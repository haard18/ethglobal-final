/**
 * Conversation Context Manager
 * Maintains conversation state and enables agentic flow without repetitive wake words
 */

export interface ConversationContext {
    sessionId: string;
    isActive: boolean;
    lastInteraction: Date;
    conversationHistory: Array<{
        timestamp: Date;
        userInput: string;
        botResponse: string;
        action?: string;
        parameters?: any;
    }>;
    currentTopic?: string;
    awaitingConfirmation?: {
        action: string;
        parameters: any;
        confirmationRequired: boolean;
    } | undefined;
    userPreferences: {
        defaultWallet?: string;
        preferredDisplayDuration?: number;
        voiceFeedbackEnabled?: boolean;
    };
    // Market data context
    lastQueriedToken?: string;
    lastQueriedAddress?: string;
}

export class ConversationManager {
    private contexts: Map<string, ConversationContext> = new Map();
    private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_HISTORY_LENGTH = 20;

    /**
     * Create or get existing conversation context
     */
    getOrCreateContext(sessionId: string = 'default'): ConversationContext {
        let context = this.contexts.get(sessionId);
        
        if (!context) {
            context = {
                sessionId,
                isActive: true,
                lastInteraction: new Date(),
                conversationHistory: [],
                userPreferences: {
                    voiceFeedbackEnabled: true,
                    preferredDisplayDuration: 8
                }
            };
            this.contexts.set(sessionId, context);
        }
        
        // Update last interaction
        context.lastInteraction = new Date();
        context.isActive = true;
        
        return context;
    }

    /**
     * Add interaction to conversation history
     */
    addInteraction(
        sessionId: string,
        userInput: string,
        botResponse: string,
        action?: string,
        parameters?: any
    ): void {
        const context = this.getOrCreateContext(sessionId);
        
        context.conversationHistory.push({
            timestamp: new Date(),
            userInput,
            botResponse,
            ...(action && { action }),
            ...(parameters && { parameters })
        });

        // Keep history manageable
        if (context.conversationHistory.length > this.MAX_HISTORY_LENGTH) {
            context.conversationHistory = context.conversationHistory.slice(-this.MAX_HISTORY_LENGTH);
        }
    }

    /**
     * Check if session is active and within timeout
     */
    isSessionActive(sessionId: string): boolean {
        const context = this.contexts.get(sessionId);
        if (!context) return false;

        const timeSinceLastInteraction = Date.now() - context.lastInteraction.getTime();
        const isWithinTimeout = timeSinceLastInteraction < this.SESSION_TIMEOUT;
        
        if (!isWithinTimeout) {
            context.isActive = false;
        }

        return context.isActive && isWithinTimeout;
    }

    /**
     * Set confirmation requirement for dangerous operations
     */
    setAwaitingConfirmation(
        sessionId: string,
        action: string,
        parameters: any,
        confirmationRequired: boolean = true
    ): void {
        const context = this.getOrCreateContext(sessionId);
        context.awaitingConfirmation = {
            action,
            parameters,
            confirmationRequired
        };
    }

    /**
     * Get pending confirmation
     */
    getPendingConfirmation(sessionId: string): ConversationContext['awaitingConfirmation'] {
        const context = this.contexts.get(sessionId);
        return context?.awaitingConfirmation;
    }

    /**
     * Clear pending confirmation
     */
    clearPendingConfirmation(sessionId: string): void {
        const context = this.contexts.get(sessionId);
        if (context) {
            context.awaitingConfirmation = undefined;
        }
    }

    /**
     * Get conversation context for AI to understand user intent better
     */
    getContextSummary(sessionId: string): string {
        const context = this.contexts.get(sessionId);
        if (!context || context.conversationHistory.length === 0) {
            return "This is a new conversation.";
        }

        const recentHistory = context.conversationHistory.slice(-5);
        const summary = recentHistory.map(h => 
            `User: "${h.userInput}" -> Action: ${h.action || 'conversation'}`
        ).join('\n');

        let contextSummary = `Recent conversation:\n${summary}`;

        if (context.currentTopic) {
            contextSummary += `\nCurrent topic: ${context.currentTopic}`;
        }

        if (context.awaitingConfirmation) {
            contextSummary += `\nAwaiting confirmation for: ${context.awaitingConfirmation.action}`;
        }

        return contextSummary;
    }

    /**
     * Set current topic for context
     */
    setCurrentTopic(sessionId: string, topic: string): void {
        const context = this.getOrCreateContext(sessionId);
        context.currentTopic = topic;
    }

    /**
     * End conversation session
     */
    endSession(sessionId: string): void {
        const context = this.contexts.get(sessionId);
        if (context) {
            context.isActive = false;
        }
    }

    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions(): void {
        const now = Date.now();
        for (const [sessionId, context] of this.contexts.entries()) {
            const timeSinceLastInteraction = now - context.lastInteraction.getTime();
            if (timeSinceLastInteraction > this.SESSION_TIMEOUT) {
                this.contexts.delete(sessionId);
            }
        }
    }

    /**
     * Get active session count
     */
    getActiveSessionCount(): number {
        const now = Date.now();
        let activeCount = 0;
        for (const context of this.contexts.values()) {
            const timeSinceLastInteraction = now - context.lastInteraction.getTime();
            if (timeSinceLastInteraction < this.SESSION_TIMEOUT && context.isActive) {
                activeCount++;
            }
        }
        return activeCount;
    }

    /**
     * Update user preferences
     */
    updateUserPreferences(sessionId: string, preferences: Partial<ConversationContext['userPreferences']>): void {
        const context = this.getOrCreateContext(sessionId);
        context.userPreferences = { ...context.userPreferences, ...preferences };
    }

    /**
     * Add simple history entry (convenience method)
     */
    addSimpleHistory(sessionId: string, type: 'user' | 'assistant', message: string): void {
        if (type === 'user') {
            this.addInteraction(sessionId, message, '');
        } else {
            // Update the last entry with the assistant response
            const context = this.getOrCreateContext(sessionId);
            if (context.conversationHistory.length > 0) {
                const lastEntry = context.conversationHistory[context.conversationHistory.length - 1];
                if (lastEntry) {
                    lastEntry.botResponse = message;
                }
            } else {
                this.addInteraction(sessionId, '', message);
            }
        }
    }
}

// Export singleton instance
export const conversationManager = new ConversationManager();

// Cleanup expired sessions every 10 minutes
setInterval(() => {
    conversationManager.cleanupExpiredSessions();
}, 10 * 60 * 1000);
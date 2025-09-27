import axios from 'axios';

/**
 * UI Synchronization Service
 * Manages display states and provides visual feedback synchronized with voice commands
 */

interface DisplayOptions {
    text: string;
    emotion: string;
    duration: number;
}

interface DisplayResponse {
    success: boolean;
    text: string;
    emotion: string;
    duration: number;
}

export class UISyncService {
    private displayUrl: string;
    private isDisplayAvailable: boolean = false;

    constructor(displayHost: string = "172.30.142.11", displayPort: number = 5000) {
        this.displayUrl = `http://${displayHost}:${displayPort}`;
        this.checkDisplayAvailability();
    }

    /**
     * Check if display service is available
     */
    private async checkDisplayAvailability(): Promise<void> {
        try {
            await axios.get(`${this.displayUrl}/status`, { timeout: 2000 });
            this.isDisplayAvailable = true;
            console.log('✅ Display service is available');
        } catch (error) {
            this.isDisplayAvailable = false;
            console.log('⚠️ Display service is not available');
        }
    }

    /**
     * Show listening state on display
     */
    async showListeningState(): Promise<void> {
        if (!this.isDisplayAvailable) return;
        
        try {
            await axios.post(`${this.displayUrl}/display`, {
                text: "Listening...",
                emotion: "wave",
                duration: 30
            }, { timeout: 3000 });
        } catch (error) {
            console.error('Display update failed (listening):', error);
        }
    }

    /**
     * Show processing state on display
     */
    async showProcessingState(command?: string): Promise<void> {
        if (!this.isDisplayAvailable) return;
        
        try {
            const text = command ? `Processing: ${command}` : "Processing...";
            await axios.post(`${this.displayUrl}/display`, {
                text,
                emotion: "confused",
                duration: 10
            }, { timeout: 3000 });
        } catch (error) {
            console.error('Display update failed (processing):', error);
        }
    }

    /**
     * Show success state on display
     */
    async showSuccessState(message: string, duration: number = 8): Promise<void> {
        if (!this.isDisplayAvailable) return;
        
        try {
            await axios.post(`${this.displayUrl}/display`, {
                text: message,
                emotion: "happy",
                duration
            }, { timeout: 3000 });
        } catch (error) {
            console.error('Display update failed (success):', error);
        }
    }

    /**
     * Show error state on display
     */
    async showErrorState(message: string, duration: number = 8): Promise<void> {
        if (!this.isDisplayAvailable) return;
        
        try {
            await axios.post(`${this.displayUrl}/display`, {
                text: message,
                emotion: "sad",
                duration
            }, { timeout: 3000 });
        } catch (error) {
            console.error('Display update failed (error):', error);
        }
    }

    /**
     * Show wallet creation state
     */
    async showWalletCreationState(): Promise<void> {
        if (!this.isDisplayAvailable) return;
        
        try {
            await axios.post(`${this.displayUrl}/display`, {
                text: "Creating wallet...",
                emotion: "excited",
                duration: 15
            }, { timeout: 3000 });
        } catch (error) {
            console.error('Display update failed (wallet creation):', error);
        }
    }

    /**
     * Show transfer state
     */
    async showTransferState(amount: string, to: string): Promise<void> {
        if (!this.isDisplayAvailable) return;
        
        try {
            const shortTo = to.length > 10 ? `${to.slice(0, 6)}...${to.slice(-4)}` : to;
            await axios.post(`${this.displayUrl}/display`, {
                text: `Sending ${amount} ETH to ${shortTo}`,
                emotion: "normal",
                duration: 20
            }, { timeout: 3000 });
        } catch (error) {
            console.error('Display update failed (transfer):', error);
        }
    }

    /**
     * Show balance state
     */
    async showBalanceState(balance?: string): Promise<void> {
        if (!this.isDisplayAvailable) return;
        
        try {
            const text = balance ? `Balance: ${balance} ETH` : "Checking balance...";
            await axios.post(`${this.displayUrl}/display`, {
                text,
                emotion: "normal",
                duration: 10
            }, { timeout: 3000 });
        } catch (error) {
            console.error('Display update failed (balance):', error);
        }
    }

    /**
     * Show custom message on display
     */
    async showCustomMessage(text: string, emotion: string = "normal", duration: number = 8): Promise<void> {
        if (!this.isDisplayAvailable) return;
        
        try {
            await axios.post(`${this.displayUrl}/display`, {
                text,
                emotion,
                duration
            }, { timeout: 3000 });
        } catch (error) {
            console.error('Display update failed (custom):', error);
        }
    }

    /**
     * Clear display and return to normal state
     */
    async clearDisplay(): Promise<void> {
        if (!this.isDisplayAvailable) return;
        
        try {
            await axios.post(`${this.displayUrl}/display`, {
                text: "",
                emotion: "normal",
                duration: 1
            }, { timeout: 3000 });
        } catch (error) {
            console.error('Display update failed (clear):', error);
        }
    }

    /**
     * Show wake word detected state
     */
    async showWakeWordDetected(): Promise<void> {
        if (!this.isDisplayAvailable) return;
        
        try {
            await axios.post(`${this.displayUrl}/display`, {
                text: "Hey Pluto! 👋",
                emotion: "excited",
                duration: 5
            }, { timeout: 3000 });
        } catch (error) {
            console.error('Display update failed (wake word):', error);
        }
    }
}

// Export singleton instance
export const uiSyncService = new UISyncService();
import fs from 'fs';
import path from 'path';
import { type WalletInfo } from './walletCreation.ts';
import { showDisplayMessage } from '../utils/display.js';

// Define a consistent path for wallet storage
const WALLET_STORAGE_DIR = path.join(process.cwd(), 'wallet-storage');
const WALLET_FILE_PATH = path.join(WALLET_STORAGE_DIR, 'user-wallet.json');

export interface StoredWallet {
    walletInfo: WalletInfo;
    createdAt: string;
    lastUsed: string;
    metadata?: {
        label?: string;
        notes?: string;
    };
}

export interface StoredWalletCollection {
    wallets: StoredWallet[];
    totalCount: number;
    lastUpdated: string;
}

export class WalletStorageService {
    /**
     * Ensure the wallet storage directory exists
     */
    private static ensureStorageDir(): void {
        if (!fs.existsSync(WALLET_STORAGE_DIR)) {
            fs.mkdirSync(WALLET_STORAGE_DIR, { recursive: true });
        }
    }

    /**
     * Load wallet collection from persistent storage
     */
    private static loadWalletCollection(): StoredWalletCollection {
        try {
            if (!fs.existsSync(WALLET_FILE_PATH)) {
                console.log('📁 No existing wallet collection found in storage');
                return {
                    wallets: [],
                    totalCount: 0,
                    lastUpdated: new Date().toISOString()
                };
            }

            const walletData = fs.readFileSync(WALLET_FILE_PATH, 'utf8');
            const data = JSON.parse(walletData);
            
            // Handle backward compatibility with old single-wallet format
            if (data.walletInfo) {
                console.log('🔄 Converting old single-wallet format to collection format');
                const oldWallet: StoredWallet = data as StoredWallet;
                return {
                    wallets: [oldWallet],
                    totalCount: 1,
                    lastUpdated: new Date().toISOString()
                };
            }
            
            return data as StoredWalletCollection;
        } catch (error) {
            console.error('❌ Failed to load wallet collection:', error);
            return {
                wallets: [],
                totalCount: 0,
                lastUpdated: new Date().toISOString()
            };
        }
    }

    /**
     * Save wallet collection to persistent storage
     */
    private static saveWalletCollection(collection: StoredWalletCollection): void {
        this.ensureStorageDir();
        
        try {
            collection.lastUpdated = new Date().toISOString();
            collection.totalCount = collection.wallets.length;
            fs.writeFileSync(WALLET_FILE_PATH, JSON.stringify(collection, null, 2));
            console.log(`✅ Wallet collection saved to: ${WALLET_FILE_PATH}`);
        } catch (error) {
            console.error('❌ Failed to save wallet collection:', error);
            throw new Error(`Failed to save wallet collection: ${error}`);
        }
    }

    /**
     * Add new wallet to the collection
     */
    static async saveWallet(walletInfo: WalletInfo, metadata?: any): Promise<void> {
        const collection = this.loadWalletCollection();
        
        const newWallet: StoredWallet = {
            walletInfo,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            metadata
        };

        // Check if wallet already exists (by address)
        const existingIndex = collection.wallets.findIndex(
            w => w.walletInfo.address === walletInfo.address
        );

        if (existingIndex !== -1) {
            console.log(`� Updating existing wallet: ${walletInfo.address}`);
            collection.wallets[existingIndex] = newWallet;
        } else {
            console.log(`➕ Adding new wallet: ${walletInfo.address}`);
            collection.wallets.push(newWallet);
        }

        this.saveWalletCollection(collection);
    }

    /**
     * Load the most recently used wallet from persistent storage
     */
    static async loadWallet(): Promise<StoredWallet | null> {
        const collection = this.loadWalletCollection();
        
        if (collection.wallets.length === 0) {
            console.log('📁 No wallets found in collection');
            
            // Show no wallet message on display
            try {
                await showDisplayMessage({
                    text: 'No Wallets Found\nCreate a new wallet',
                    emotion: 'confused',
                    duration: 5
                });
            } catch (displayError) {
                console.warn('Display error:', displayError);
            }
            
            return null;
        }

        // Find the most recently used wallet
        const mostRecentWallet = collection.wallets.reduce((latest, current) => {
            return new Date(current.lastUsed) > new Date(latest.lastUsed) ? current : latest;
        });

        // Update the last used time for this wallet
        mostRecentWallet.lastUsed = new Date().toISOString();
        this.saveWalletCollection(collection);
        
        console.log(`✅ Most recent wallet loaded from storage: ${mostRecentWallet.walletInfo.address}`);
        
        // Show wallet address on display
        try {
            await showDisplayMessage({
                text: `Active Wallet\n${mostRecentWallet.walletInfo.address.substring(0, 10)}...${mostRecentWallet.walletInfo.address.substring(mostRecentWallet.walletInfo.address.length - 8)}`,
                emotion: 'normal',
                duration: 5
            });
        } catch (displayError) {
            console.warn('Display error:', displayError);
        }
        
        return mostRecentWallet;
    }

    /**
     * Get count of existing wallets
     */
    static getWalletCount(): number {
        const collection = this.loadWalletCollection();
        return collection.totalCount;
    }

    /**
     * Get all wallets in the collection
     */
    static getAllWallets(): StoredWallet[] {
        const collection = this.loadWalletCollection();
        return collection.wallets;
    }

    /**
     * Get wallet collection summary for announcements
     */
    static getWalletSummary(): { count: number; addresses: string[] } {
        const collection = this.loadWalletCollection();
        return {
            count: collection.totalCount,
            addresses: collection.wallets.map(w => w.walletInfo.address)
        };
    }

    /**
     * Check if any wallets exist in storage
     */
    static hasWallet(): boolean {
        const collection = this.loadWalletCollection();
        return collection.totalCount > 0;
    }

    /**
     * Delete specific wallet from storage by address
     */
    static deleteWallet(address?: string): boolean {
        try {
            const collection = this.loadWalletCollection();
            
            if (!address) {
                // Delete all wallets
                collection.wallets = [];
                this.saveWalletCollection(collection);
                console.log('✅ All wallets deleted from storage');
                return true;
            }

            const initialCount = collection.wallets.length;
            collection.wallets = collection.wallets.filter(
                w => w.walletInfo.address !== address
            );

            if (collection.wallets.length < initialCount) {
                this.saveWalletCollection(collection);
                console.log(`✅ Wallet ${address} deleted from storage`);
                return true;
            } else {
                console.log(`⚠️ Wallet ${address} not found in storage`);
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to delete wallet:', error);
            return false;
        }
    }

    /**
     * Get the wallet storage path for GPT to reference
     */
    static getStoragePath(): string {
        return WALLET_FILE_PATH;
    }

    /**
     * Get wallet address of the most recent wallet if exists
     */
    static async getWalletAddress(): Promise<string | null> {
        const wallet = await this.loadWallet();
        return wallet ? wallet.walletInfo.address : null;
    }
    
    /**
     * Get wallet address synchronously (for compatibility)
     */
    static getWalletAddressSync(): string | null {
        const collection = this.loadWalletCollection();
        
        if (collection.wallets.length === 0) {
            return null;
        }

        // Find the most recently used wallet
        const mostRecentWallet = collection.wallets.reduce((latest, current) => {
            return new Date(current.lastUsed) > new Date(latest.lastUsed) ? current : latest;
        });

        return mostRecentWallet.walletInfo.address;
    }
}
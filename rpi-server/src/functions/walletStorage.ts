import fs from 'fs';
import path from 'path';
import { type WalletInfo } from './walletCreation.js';

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
     * Save wallet to persistent storage
     */
    static saveWallet(walletInfo: WalletInfo, metadata?: any): void {
        this.ensureStorageDir();
        
        const storedWallet: StoredWallet = {
            walletInfo,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            metadata
        };

        try {
            fs.writeFileSync(WALLET_FILE_PATH, JSON.stringify(storedWallet, null, 2));
            console.log(`✅ Wallet saved to: ${WALLET_FILE_PATH}`);
        } catch (error) {
            console.error('❌ Failed to save wallet:', error);
            throw new Error(`Failed to save wallet: ${error}`);
        }
    }

    /**
     * Load wallet from persistent storage
     */
    static loadWallet(): StoredWallet | null {
        try {
            if (!fs.existsSync(WALLET_FILE_PATH)) {
                console.log('📁 No existing wallet found in storage');
                return null;
            }

            const walletData = fs.readFileSync(WALLET_FILE_PATH, 'utf8');
            const storedWallet: StoredWallet = JSON.parse(walletData);
            
            // Update last used time
            storedWallet.lastUsed = new Date().toISOString();
            this.saveWallet(storedWallet.walletInfo, storedWallet.metadata);
            
            console.log(`✅ Wallet loaded from storage: ${storedWallet.walletInfo.address}`);
            return storedWallet;
        } catch (error) {
            console.error('❌ Failed to load wallet:', error);
            return null;
        }
    }

    /**
     * Check if a wallet exists in storage
     */
    static hasWallet(): boolean {
        return fs.existsSync(WALLET_FILE_PATH);
    }

    /**
     * Delete wallet from storage
     */
    static deleteWallet(): boolean {
        try {
            if (fs.existsSync(WALLET_FILE_PATH)) {
                fs.unlinkSync(WALLET_FILE_PATH);
                console.log('✅ Wallet deleted from storage');
                return true;
            }
            return false;
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
     * Get wallet address if exists
     */
    static getWalletAddress(): string | null {
        const wallet = this.loadWallet();
        return wallet ? wallet.walletInfo.address : null;
    }
}
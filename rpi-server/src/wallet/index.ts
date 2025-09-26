import { ethers } from 'ethers';
import { randomBytes } from 'crypto';

export interface WalletInfo {
    address: string;
    privateKey: string;
    mnemonic: string;
    publicKey: string;
}

export class EthereumWalletGenerator {
    
    /**
     * Generates a new Ethereum wallet with private key, public key, address and mnemonic
     */
    static generateWallet(): WalletInfo {
        try {
            // Generate random entropy for wallet creation
            const entropy = randomBytes(16);
            
            // Create wallet from entropy
            const mnemonic = ethers.Mnemonic.fromEntropy(entropy);
            const wallet = ethers.Wallet.fromPhrase(mnemonic.phrase);
            const signingKey = wallet.signingKey;

            return {
                address: wallet.address,
                privateKey: wallet.privateKey,
                mnemonic: mnemonic.phrase,
                publicKey: signingKey.publicKey
            };
        } catch (error) {
            throw new Error(`Failed to generate wallet: ${error}`);
        }
    }

    /**
     * Validates if an address is a valid Ethereum address
     */
    static isValidAddress(address: string): boolean {
        return ethers.isAddress(address);
    }

    /**
     * Creates wallet from private key
     */
    static fromPrivateKey(privateKey: string): WalletInfo {
        try {
            const wallet = new ethers.Wallet(privateKey);
            const signingKey = wallet.signingKey;
            return {
                address: wallet.address,
                privateKey: wallet.privateKey,
                mnemonic: '',
                publicKey: signingKey.publicKey
            };
        } catch (error) {
            throw new Error(`Failed to create wallet from private key: ${error}`);
        }
    }

    /**
     * Creates wallet from mnemonic phrase
     */
    static fromMnemonic(mnemonic: string): WalletInfo {
        try {
            const wallet = ethers.Wallet.fromPhrase(mnemonic);
            const signingKey = wallet.signingKey;
            return {
                address: wallet.address,
                privateKey: wallet.privateKey,
                mnemonic: mnemonic,
                publicKey: signingKey.publicKey
            };
        } catch (error) {
            throw new Error(`Failed to create wallet from mnemonic: ${error}`);
        }
    }
}
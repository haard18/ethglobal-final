import { ethers } from 'ethers';
import { randomBytes } from 'crypto';
import { showDisplayMessage } from '../utils/display.js';

export interface WalletInfo {
    address: string;
    privateKey: string;
    mnemonic: string;
    publicKey: string;
}

export interface TransferResult {
    success: boolean;
    transactionHash?: string;
    error?: string;
    details?: {
        from: string;
        to: string;
        amount: string;
        gasUsed?: string;
        gasPrice?: string;
    };
}

export class EthereumWalletGenerator {
    /**
     * Generates a new Ethereum wallet with private key, public key, address and mnemonic
     */
    static async generateWallet(): Promise<WalletInfo> {
        try {
            // Generate random entropy for wallet creation
            const entropy = randomBytes(16);
            // Create wallet from entropy
            const mnemonic = ethers.Mnemonic.fromEntropy(entropy);
            const wallet = ethers.Wallet.fromPhrase(mnemonic.phrase);
            const signingKey = wallet.signingKey;
            
            const walletInfo = {
                address: wallet.address,
                privateKey: wallet.privateKey,
                mnemonic: mnemonic.phrase,
                publicKey: signingKey.publicKey
            };
            
            // Show success on display
            try {
                await showDisplayMessage({
                    text: `Wallet Created!\n${wallet.address.substring(0, 8)}...${wallet.address.substring(wallet.address.length - 6)}`,
                    emotion: 'happy',
                    duration: 8
                });
            } catch (displayError) {
                console.warn('Display error:', displayError);
            }
            
            return walletInfo;
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
            throw new Error(`Invalid private key: ${error}`);
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
                mnemonic,
                publicKey: signingKey.publicKey
            };
        } catch (error) {
            throw new Error(`Invalid mnemonic: ${error}`);
        }
    }

    /**
     * Transfer ETH to ENS name or address
     * @param fromWallet - Wallet info of sender
     * @param toAddressOrEns - ENS name or Ethereum address
     * @param amount - Amount in ETH (as string, e.g., "0.1")
     * @param rpcUrl - RPC endpoint URL (optional, defaults to public endpoint)
     */
    static async transferETH(
        fromWallet: WalletInfo,
        toAddressOrEns: string,
        amount: string,
        rpcUrl?: string
    ): Promise<TransferResult> {
        try {
            // Connect to provider
            const provider = new ethers.JsonRpcProvider(rpcUrl || 'https://eth.llamarpc.com');
            const wallet = new ethers.Wallet(fromWallet.privateKey, provider);

            // Resolve ENS name to address if needed
            let toAddress: string;
            if (toAddressOrEns.endsWith('.eth')) {
                console.log(`🔍 Resolving ENS name: ${toAddressOrEns}`);
                const resolvedAddress = await provider.resolveName(toAddressOrEns);
                if (!resolvedAddress) {
                    throw new Error(`Could not resolve ENS name: ${toAddressOrEns}`);
                }
                toAddress = resolvedAddress;
                console.log(`✅ ENS resolved: ${toAddressOrEns} → ${toAddress}`);
            } else {
                if (!ethers.isAddress(toAddressOrEns)) {
                    throw new Error(`Invalid address: ${toAddressOrEns}`);
                }
                toAddress = toAddressOrEns;
            }

            // Parse amount to wei
            const amountWei = ethers.parseEther(amount);

            // Check balance
            const balance = await provider.getBalance(wallet.address);
            if (balance < amountWei) {
                throw new Error(`Insufficient balance. Have: ${ethers.formatEther(balance)} ETH, Need: ${amount} ETH`);
            }

            // Get gas estimate
            const gasLimit = await provider.estimateGas({
                to: toAddress,
                value: amountWei,
                from: wallet.address
            });

            const gasPrice = await provider.getFeeData();
            const gasCost = gasLimit * (gasPrice.gasPrice || 0n);

            // Check if we have enough for gas
            if (balance < amountWei + gasCost) {
                throw new Error(`Insufficient balance for gas. Need additional: ${ethers.formatEther(gasCost)} ETH for gas`);
            }

            // Create transaction
            const transaction = {
                to: toAddress,
                value: amountWei,
                gasLimit: gasLimit,
                gasPrice: gasPrice.gasPrice
            };

            console.log(`💸 Sending ${amount} ETH from ${wallet.address} to ${toAddress}`);
            
            // Send transaction
            const txResponse = await wallet.sendTransaction(transaction);
            console.log(`📤 Transaction sent: ${txResponse.hash}`);

            // Wait for confirmation
            const receipt = await txResponse.wait();
            
            if (receipt?.status === 1) {
                console.log(`✅ Transfer successful! Hash: ${txResponse.hash}`);
                
                // Show success on display
                try {
                    await showDisplayMessage({
                        text: `Transfer Complete!\n${amount} ETH sent\n${txResponse.hash.substring(0, 10)}...`,
                        emotion: 'excited',
                        duration: 10
                    });
                } catch (displayError) {
                    console.warn('Display error:', displayError);
                }
                
                return {
                    success: true,
                    transactionHash: txResponse.hash,
                    details: {
                        from: wallet.address,
                        to: toAddress,
                        amount: amount,
                        gasUsed: receipt.gasUsed.toString(),
                        gasPrice: (gasPrice.gasPrice || 0n).toString()
                    }
                };
            } else {
                throw new Error('Transaction failed');
            }

        } catch (error) {
            console.error('❌ Transfer failed:', error);
            
            // Show error on display
            try {
                await showDisplayMessage({
                    text: `Transfer Failed!\nCheck balance & network`,
                    emotion: 'angry',
                    duration: 8
                });
            } catch (displayError) {
                console.warn('Display error:', displayError);
            }
            
            return {
                success: false,
                error: `Transfer failed: ${error}`
            };
        }
    }
}

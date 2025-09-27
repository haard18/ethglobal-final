import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { WalrusClient, WalrusFile } from '@mysten/walrus';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';
import fs from 'fs';
import path from 'path';

interface StoredWallet {
  walletInfo: {
    address: string;
    privateKey: string;
    mnemonic: string;
    publicKey: string;
  };
  createdAt: string;
  lastUsed: string;
  metadata?: {
    label?: string;
    notes?: string;
  };
}

// Configuration
const WALLET_STORAGE_PATH = path.join(process.cwd(), 'wallet-storage', 'user-wallet.json');
const NETWORK = 'testnet'; // Using testnet for development
const WALRUS_EPOCHS = 3; // Store for 3 epochs
const WALRUS_DELETABLE = true; // Allow deletion if needed

// Initialize Walrus client
const suiClient = new SuiClient({ url: getFullnodeUrl(NETWORK) });

// Create Walrus client with optional upload relay configuration
const walrusClient = new WalrusClient({
  network: NETWORK,
  suiClient,
  uploadRelay: {
    host: 'https://upload-relay.testnet.walrus.space',
    sendTip: {
      max: 1_000, // Maximum tip in MIST
    },
  },
});

/**
 * Load wallet from local storage
 */
function loadWalletFromStorage(): StoredWallet | null {
  try {
    if (!fs.existsSync(WALLET_STORAGE_PATH)) {
      console.log('No wallet found in storage');
      return null;
    }

    const walletData = fs.readFileSync(WALLET_STORAGE_PATH, 'utf8');
    return JSON.parse(walletData);
  } catch (error) {
    console.error('Error loading wallet:', error);
    return null;
  }
}

/**
 * Create a keypair from the stored wallet's private key
 */
function createKeypairFromWallet(wallet: StoredWallet): Ed25519Keypair {
  // Convert the private key from base64 to Uint8Array
  const privateKeyHex = wallet.walletInfo.privateKey.startsWith('0x')
    ? wallet.walletInfo.privateKey.slice(2)
    : wallet.walletInfo.privateKey;
  const privateKeyBytes = fromB64(privateKeyHex);
  return Ed25519Keypair.fromSecretKey(privateKeyBytes);
}

/**
 * Upload wallet to Walrus storage with a key like "pluto wallet 1"
 */
export async function uploadWalletToWalrus(walletIndex: number = 1): Promise<{
  success: boolean;
  blobId?: string;
  walletKey?: string;
  error?: string;
}> {
  try {
    // Load wallet from storage
    const wallet = loadWalletFromStorage();
    if (!wallet) {
      return {
        success: false,
        error: 'No wallet found in local storage'
      };
    }

    // Create keypair from wallet
    const keypair = createKeypairFromWallet(wallet);

    // Create wallet key (e.g., "pluto wallet 1")
    const walletKey = `pluto wallet ${walletIndex}`;

    // Prepare wallet data for storage
    const walletData = {
      address: wallet.walletInfo.address,
      publicKey: wallet.walletInfo.publicKey,
      createdAt: wallet.createdAt,
      lastUsed: wallet.lastUsed,
      metadata: wallet.metadata || {}
    };

    // Create WalrusFile from wallet data
    const walletFile = WalrusFile.from({
      contents: new TextEncoder().encode(JSON.stringify(walletData, null, 2)),
      identifier: walletKey,
      tags: {
        'content-type': 'application/json',
        'wallet-type': 'pluto',
        'wallet-index': walletIndex.toString()
      }
    });

    // Upload to Walrus
    console.log(`Uploading wallet ${walletKey} to Walrus...`);
    const result = await walrusClient.writeFiles({
      files: [walletFile],
      epochs: WALRUS_EPOCHS,
      deletable: WALRUS_DELETABLE,
      signer: keypair
    });

    if (!result || result.length === 0) {
      throw new Error('No result returned from Walrus upload');
    }

    const uploadedFile = result[0];
    if (!uploadedFile || !uploadedFile.blobId) {
      throw new Error('Invalid result returned from Walrus upload');
    }

    console.log(`Successfully uploaded wallet ${walletKey} to Walrus!`);
    console.log(`Blob ID: ${uploadedFile.blobId}`);

    return {
      success: true,
      blobId: uploadedFile.blobId,
      walletKey
    };

  } catch (error) {
    console.error('Error uploading wallet to Walrus:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Retrieve wallet from Walrus storage by key
 */
export async function getWalletFromWalrus(walletKey: string): Promise<{
  success: boolean;
  walletData?: any;
  error?: string;
}> {
  try {
    // Find blobs with the matching identifier
    const files = await walrusClient.getFiles({
      ids: [walletKey]
    });

    if (files.length === 0) {
      return {
        success: false,
        error: `Wallet with key "${walletKey}" not found in Walrus storage`
      };
    }

    const walletFile = files[0];
    if (!walletFile) {
      return {
        success: false,
        error: `Invalid file data for wallet with key "${walletKey}"`
      };
    }

    const walletData = JSON.parse(await walletFile.text());

    return {
      success: true,
      walletData
    };

  } catch (error) {
    console.error('Error retrieving wallet from Walrus:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * List all Pluto wallets from Walrus storage
 * Note: This function is currently limited as the Walrus API requires specific IDs
 * to retrieve files. A full listing would require maintaining a separate index.
 */
export async function listPlutoWallets(): Promise<{
  success: boolean;
  wallets?: Array<{ key: string; blobId: string; walletData: any }>;
  error?: string;
}> {
  try {
    // Since getFiles requires specific IDs, we'll need to try common wallet keys
    // In a production system, you'd want to maintain an index of wallet keys
    const commonWalletKeys = [
      'pluto wallet 1',
      'pluto wallet 2', 
      'pluto wallet 3',
      'pluto wallet 4',
      'pluto wallet 5'
    ];

    const wallets = [];

    for (const walletKey of commonWalletKeys) {
      try {
        const result = await getWalletFromWalrus(walletKey);
        if (result.success && result.walletData) {
          wallets.push({
            key: walletKey,
            blobId: 'unknown', // We don't have direct access to blob ID from this method
            walletData: result.walletData
          });
        }
      } catch (error) {
        // Silently continue if wallet doesn't exist
        continue;
      }
    }

    return {
      success: true,
      wallets
    };

  } catch (error) {
    console.error('Error listing Pluto wallets:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Main function to demonstrate usage
 */
export async function demo() {
  console.log('=== Walrus Wallet Storage Demo ===');

  // 1. Upload wallet to Walrus
  const uploadResult = await uploadWalletToWalrus(1);
  if (!uploadResult.success || !uploadResult.walletKey) {
    console.error('Failed to upload wallet:', uploadResult.error);
    return;
  }

  console.log(`\nUploaded wallet with key: ${uploadResult.walletKey}`);
  console.log(`Blob ID: ${uploadResult.blobId}`);

  // 2. Retrieve the wallet
  console.log('\nRetrieving wallet from Walrus...');
  const retrieveResult = await getWalletFromWalrus(uploadResult.walletKey);
  if (!retrieveResult.success) {
    console.error('Failed to retrieve wallet:', retrieveResult.error);
    return;
  }

  console.log('Retrieved wallet data:', retrieveResult.walletData);

  // 3. List all Pluto wallets
  console.log('\nListing all Pluto wallets...');
  const listResult = await listPlutoWallets();
  if (!listResult.success) {
    console.error('Failed to list wallets:', listResult.error);
    return;
  }

  console.log(`Found ${listResult.wallets?.length} Pluto wallets:`);
  listResult.wallets?.forEach(wallet => {
    console.log(`- ${wallet.key} (Blob ID: ${wallet.blobId})`);
  });
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error);
}

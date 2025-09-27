import { uploadWalletToWalrus, getWalletFromWalrus, listPlutoWallets } from './index.ts';

const uploadResult = await uploadWalletToWalrus(1);
if (uploadResult.success) {
  console.log(`Uploaded wallet ${uploadResult.walletKey} with blob ID ${uploadResult.blobId}`);
}

const wallet = await getWalletFromWalrus('pluto wallet 1');
if (wallet.success) {
  console.log('Wallet data:', wallet.walletData);
}

const wallets = await listPlutoWallets();
if (wallets.success) {
  console.log('All Pluto wallets:', wallets.wallets);
}

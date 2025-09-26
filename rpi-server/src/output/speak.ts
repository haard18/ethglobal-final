import say from 'say';

/**
 * Speak the given text out loud using the system's TTS.
 * @param text - Text to speak
 */
export function speakText(text: string) {
    // Use default voice (null) which is more compatible across systems
    // Alternative: you can try 'Alex', 'Samantha', or other system voices
    
    say.speak(text, undefined, 1.0, (err) => {
        if (err) {
            console.error('Error speaking text:', err);
        } else {
            console.log('Finished speaking.');
        }
    });
}

/**
 * Announce wallet count before creation
 * @param count - Number of existing wallets
 */
export function announceWalletCount(count: number) {
    let message: string;
    
    if (count === 0) {
        message = "You currently have no existing wallets. Creating your first wallet now.";
    } else if (count === 1) {
        message = "You currently have 1 existing wallet. Creating an additional wallet now.";
    } else {
        message = `You currently have ${count} existing wallets. Creating an additional wallet now.`;
    }
    
    console.log(`🔊 Announcing: ${message}`);
    speakText(message);
}

/**
 * Announce successful wallet creation
 * @param address - The new wallet address
 * @param totalCount - Total wallet count after creation
 */
export function announceWalletCreated(address: string, totalCount: number) {
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const message = `New wallet created successfully! Address ${shortAddress}. You now have ${totalCount} wallet${totalCount === 1 ? '' : 's'} in total.`;
    
    console.log(`🔊 Announcing: ${message}`);
    speakText(message);
}

/**
 * Announce transfer initiation
 * @param fromAddress - Source wallet address
 * @param toAddress - Destination address or ENS
 * @param amount - Amount being transferred
 */
export function announceTransferStart(fromAddress: string, toAddress: string, amount: string) {
    const shortFrom = `${fromAddress.slice(0, 6)}...${fromAddress.slice(-4)}`;
    const shortTo = toAddress.endsWith('.eth') ? toAddress : `${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`;
    const message = `Initiating transfer of ${amount} ETH from ${shortFrom} to ${shortTo}. Processing transaction now.`;
    
    console.log(`🔊 Transfer start: ${message}`);
    speakText(message);
}

/**
 * Announce successful transfer completion
 * @param transactionHash - Transaction hash
 * @param amount - Amount transferred
 */
export function announceTransferSuccess(transactionHash: string, amount: string) {
    const shortHash = `${transactionHash.slice(0, 8)}...${transactionHash.slice(-6)}`;
    const message = `Transfer successful! ${amount} ETH has been sent. Transaction hash ${shortHash}. The funds should arrive shortly.`;
    
    console.log(`🔊 Transfer success: ${message}`);
    speakText(message);
}

/**
 * Announce transfer failure with reason
 * @param reason - Reason for failure
 */
export function announceTransferFailure(reason: string) {
    const message = `Transfer failed. ${reason} Please check your wallet balance and try again.`;
    
    console.log(`🔊 Transfer failure: ${message}`);
    speakText(message);
}

/**
 * Announce no wallets available
 */
export function announceNoWallets() {
    const message = "No wallets found in your account. You need to create a wallet before making transfers. Would you like me to create a new wallet for you?";
    
    console.log(`🔊 No wallets: ${message}`);
    speakText(message);
}

// Example usage
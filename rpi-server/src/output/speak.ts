import say from 'say';

// Global state to track if speech is currently active
let isSpeaking = false;
let speechQueue: string[] = [];

/**
 * Speak the given text out loud using the system's TTS.
 * Only one speech command can be active at a time.
 * @param text - Text to speak
 * @param allowQueue - Whether to queue the speech if another is active (default: false)
 */
export function speakText(text: string, allowQueue: boolean = false) {
    // If currently speaking, either queue or ignore based on allowQueue parameter
    if (isSpeaking) {
        if (allowQueue) {
            console.log(`🔊 Speech in progress. Queueing: "${text}"`);
            speechQueue.push(text);
        } else {
            console.log(`🔊 Speech blocked. Another command is already speaking: "${text}"`);
        }
        return;
    }

    // Mark as speaking and execute
    isSpeaking = true;
    console.log(`🔊 Speaking: "${text}"`);
    
    say.speak(text, undefined, 1.0, (err) => {
        isSpeaking = false;
        
        if (err) {
            console.error('Error speaking text:', err);
        } else {
            console.log('Finished speaking.');
        }
        
        // Process next item in queue if any
        processNextInQueue();
    });
}

/**
 * Process the next item in the speech queue
 */
function processNextInQueue() {
    if (speechQueue.length > 0 && !isSpeaking) {
        const nextText = speechQueue.shift()!;
        console.log(`🔊 Processing queued speech: "${nextText}"`);
        speakText(nextText, false); // Don't allow re-queueing from queue processing
    }
}

/**
 * Check if speech is currently active
 */
export function isSpeechActive(): boolean {
    return isSpeaking;
}

/**
 * Clear the speech queue and stop any ongoing speech
 */
export function clearSpeechQueue() {
    speechQueue = [];
    if (isSpeaking) {
        say.stop();
        isSpeaking = false;
        console.log('🔊 Speech stopped and queue cleared.');
    }
}

/**
 * Get the current queue length
 */
export function getSpeechQueueLength(): number {
    return speechQueue.length;
}

/**
 * Announce wallet count before creation
 * @param count - Number of existing wallets
 * @param allowQueue - Whether to queue if speech is active (default: false)
 */
export function announceWalletCount(count: number, allowQueue: boolean = false) {
    let message: string;
    
    if (count === 0) {
        message = "You currently have no existing wallets. Creating your first wallet now.";
    } else if (count === 1) {
        message = "You currently have 1 existing wallet. Creating an additional wallet now.";
    } else {
        message = `You currently have ${count} existing wallets. Creating an additional wallet now.`;
    }
    
    console.log(`🔊 Announcing: ${message}`);
    speakText(message, allowQueue);
}

/**
 * Announce successful wallet creation
 * @param address - The new wallet address
 * @param totalCount - Total wallet count after creation
 * @param allowQueue - Whether to queue if speech is active (default: false)
 */
export function announceWalletCreated(address: string, totalCount: number, allowQueue: boolean = false) {
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const message = `New wallet created successfully! Address ${shortAddress}. You now have ${totalCount} wallet${totalCount === 1 ? '' : 's'} in total.`;
    
    console.log(`🔊 Announcing: ${message}`);
    speakText(message, allowQueue);
}

/**
 * Announce transfer initiation
 * @param fromAddress - Source wallet address
 * @param toAddress - Destination address or ENS
 * @param amount - Amount being transferred
 * @param allowQueue - Whether to queue if speech is active (default: false)
 */
export function announceTransferStart(fromAddress: string, toAddress: string, amount: string, allowQueue: boolean = false) {
    const shortFrom = `${fromAddress.slice(0, 6)}...${fromAddress.slice(-4)}`;
    const shortTo = toAddress.endsWith('.eth') ? toAddress : `${toAddress.slice(0, 6)}...${toAddress.slice(-4)}`;
    const message = `Initiating transfer of ${amount} ETH from ${shortFrom} to ${shortTo}. Processing transaction now.`;
    
    console.log(`🔊 Transfer start: ${message}`);
    speakText(message, allowQueue);
}

/**
 * Announce successful transfer completion
 * @param transactionHash - Transaction hash
 * @param amount - Amount transferred
 * @param allowQueue - Whether to queue if speech is active (default: false)
 */
export function announceTransferSuccess(transactionHash: string, amount: string, allowQueue: boolean = false) {
    const shortHash = `${transactionHash.slice(0, 8)}...${transactionHash.slice(-6)}`;
    const message = `Transfer successful! ${amount} ETH has been sent. Transaction hash ${shortHash}. The funds should arrive shortly.`;
    
    console.log(`🔊 Transfer success: ${message}`);
    speakText(message, allowQueue);
}

/**
 * Announce transfer failure with reason
 * @param reason - Reason for failure
 * @param allowQueue - Whether to queue if speech is active (default: false)
 */
export function announceTransferFailure(reason: string, allowQueue: boolean = false) {
    const message = `Transfer failed. ${reason} Please check your wallet balance and try again.`;
    
    console.log(`🔊 Transfer failure: ${message}`);
    speakText(message, allowQueue);
}

/**
 * Announce no wallets available
 * @param allowQueue - Whether to queue if speech is active (default: false)
 */
export function announceNoWallets(allowQueue: boolean = false) {
    const message = "No wallets found in your account. You need to create a wallet before making transfers. Would you like me to create a new wallet for you?";
    
    console.log(`🔊 No wallets: ${message}`);
    speakText(message, allowQueue);
}

// Example usage
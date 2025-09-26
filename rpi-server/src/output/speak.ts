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

// Example usage
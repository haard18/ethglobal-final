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

// Example usage
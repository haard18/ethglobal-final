"""
Pluto - AI-Powered Ethereum Wallet Assistant
A production-ready voice-controlled cryptocurrency wallet system.
"""

import os
import sys
import time
import json
import re
import difflib
import speech_recognition as sr
from dotenv import load_dotenv
from typing import List, Optional, Tuple

# Add the project path
sys.path.append(os.path.dirname(__file__))

# Load environment variables
load_dotenv()

class EnhancedAudioInput:
    """Enhanced Audio Input with robust wake word detection."""
    
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        
        # Optimize settings for wake word detection
        self.recognizer.energy_threshold = 200  # Lower for better sensitivity
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 0.6   # Shorter pause
        self.recognizer.phrase_threshold = 0.3  # Quick detection
        self.recognizer.non_speaking_duration = 0.3
        
        # Comprehensive wake word patterns with confidence weights
        self.wake_word_patterns = {
            # Primary patterns (your specified wake words)
            "hey pluto": 1.0,
            "hepluto": 1.0,
            "play pluto": 1.0,
            "pluto": 0.9,  # Slightly lower since it's generic
            
            # Common speech recognition variations
            "hai pluto": 0.95,
            "hey blue toe": 0.85,
            "hey pluton": 0.90,
            "play blue toe": 0.85,
            "hey fluto": 0.85,
            "he pluto": 0.90,
            "a pluto": 0.85,
            "hey leto": 0.80,
            "play leto": 0.80,
            "blue toe": 0.75,
            "fluto": 0.75,
            "leto": 0.70,
            
            # Phonetic variations
            "hey puto": 0.80,
            "play puto": 0.80,
            "hey photo": 0.75,
            "play photo": 0.75,
            "hey plato": 0.80,
            "play plato": 0.80,
            "plutoe": 0.85,
            "pludo": 0.80,
            "hey pluton": 0.85,
            "play pluton": 0.85,
            
            # Partial matches (lower confidence)
            "plut": 0.60,
            "luto": 0.55,
            "plu": 0.50,
        }
        
        # Minimum confidence threshold
        self.wake_threshold = 0.6
        
        print("🎤 Enhanced Audio Input initialized")
        print(f"🎯 Wake word patterns: {len(self.wake_word_patterns)} variations loaded")

    def _normalize_text(self, text: str) -> str:
        """Normalize text for better matching."""
        if not text:
            return ""
        
        # Convert to lowercase and strip
        text = text.lower().strip()
        
        # Remove punctuation and extra spaces
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()

    def _calculate_wake_word_confidence(self, text: str) -> Tuple[bool, float, str]:
        """
        Calculate confidence that the text contains a wake word.
        Returns: (is_wake_word, confidence, matched_pattern)
        """
        if not text:
            return False, 0.0, ""
        
        normalized_text = self._normalize_text(text)
        best_match = ""
        best_confidence = 0.0
        
        # Check exact matches first
        for pattern, weight in self.wake_word_patterns.items():
            if pattern in normalized_text:
                confidence = weight
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_match = pattern
        
        # If no exact match, try fuzzy matching
        if best_confidence == 0.0:
            words = normalized_text.split()
            
            for pattern, weight in self.wake_word_patterns.items():
                pattern_words = pattern.split()
                
                # Single word patterns
                if len(pattern_words) == 1:
                    pattern_word = pattern_words[0]
                    for word in words:
                        # Similarity ratio
                        similarity = difflib.SequenceMatcher(None, word, pattern_word).ratio()
                        confidence = similarity * weight * 0.8  # Reduce for fuzzy match
                        
                        if confidence > best_confidence:
                            best_confidence = confidence
                            best_match = f"{pattern} (fuzzy: {word})"
                
                # Multi-word patterns
                else:
                    # Check if all words in pattern exist (fuzzy)
                    pattern_matches = []
                    for pattern_word in pattern_words:
                        best_word_match = 0
                        for word in words:
                            similarity = difflib.SequenceMatcher(None, word, pattern_word).ratio()
                            best_word_match = max(best_word_match, similarity)
                        pattern_matches.append(best_word_match)
                    
                    if pattern_matches:
                        avg_similarity = sum(pattern_matches) / len(pattern_matches)
                        confidence = avg_similarity * weight * 0.7  # Further reduce for multi-word fuzzy
                        
                        if confidence > best_confidence:
                            best_confidence = confidence
                            best_match = f"{pattern} (fuzzy)"
        
        # Check for substring matches in longer text
        if best_confidence == 0.0:
            for pattern, weight in self.wake_word_patterns.items():
                if len(pattern) >= 4:  # Only for longer patterns
                    # Check if pattern is a substring
                    for i in range(len(normalized_text) - len(pattern) + 1):
                        substring = normalized_text[i:i + len(pattern)]
                        similarity = difflib.SequenceMatcher(None, substring, pattern).ratio()
                        if similarity > 0.8:
                            confidence = similarity * weight * 0.6  # Reduce for substring
                            if confidence > best_confidence:
                                best_confidence = confidence
                                best_match = f"{pattern} (substring: {substring})"
        
        is_wake_word = best_confidence >= self.wake_threshold
        return is_wake_word, best_confidence, best_match

    def listen_for_wake_word(self, wake_words: List[str] = None, debug: bool = True) -> bool:
        """
        Listen continuously for wake words with improved detection.
        Returns True when a wake word is detected.
        """
        print("🎤 Listening for wake word...")
        if debug:
            print("🔍 Detecting: hey pluto, hepluto, play pluto, pluto, and many variations...")
        
        while True:
            try:
                # Listen for audio
                with self.microphone as source:
                    # Quick adjustment for responsiveness
                    if not hasattr(self, '_adjusted'):
                        if debug:
                            print("🔧 Calibrating microphone...")
                        self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                        self._adjusted = True
                    
                    # Listen with shorter timeout for responsiveness
                    try:
                        audio = self.recognizer.listen(source, timeout=1, phrase_time_limit=3)
                    except sr.WaitTimeoutError:
                        continue  # Keep listening
                
                # Try to recognize
                try:
                    # Use Google Speech Recognition
                    text = self.recognizer.recognize_google(audio, language='en-US')
                    if debug:
                        print(f"🔊 Heard: '{text}'")
                    
                    # Check for wake word
                    is_wake, confidence, pattern = self._calculate_wake_word_confidence(text)
                    
                    if debug:
                        print(f"📊 Confidence: {confidence:.3f} | Match: {pattern}")
                    
                    if is_wake:
                        print(f"✅ Wake word detected! Pattern: '{pattern}' (confidence: {confidence:.3f})")
                        return True
                    
                    # If no wake word detected but we got text
                    if debug:
                        print(f"❌ No wake word in: '{text}'")
                
                except sr.UnknownValueError:
                    # No speech detected, continue listening
                    continue
                    
                except sr.RequestError as e:
                    if debug:
                        print(f"⚠️ Speech recognition error: {e}")
                    time.sleep(0.5)
                    continue
            
            except KeyboardInterrupt:
                print("\n🛑 Wake word detection stopped by user")
                return False
            except Exception as e:
                if debug:
                    print(f"❌ Error in wake word detection: {e}")
                time.sleep(0.5)
                continue

    def listen_until_silence(self, timeout: int = 100) -> Optional[sr.AudioData]:
        """Listen for audio until silence is detected."""
        try:
            with self.microphone as source:
                print("🎤 Listening for command... (speak now)")
                audio = self.recognizer.listen(source, timeout=timeout, phrase_time_limit=100)
                print("✅ Audio captured")
                return audio
        except sr.WaitTimeoutError:
            print("⏰ Listening timeout - no speech detected")
            return None
        except Exception as e:
            print(f"❌ Error capturing audio: {e}")
            return None

    def transcribe(self, audio_data: sr.AudioData) -> Optional[str]:
        """Transcribe audio data to text."""
        if not audio_data:
            return None
        
        try:
            # Try Google Speech Recognition first
            text = self.recognizer.recognize_google(audio_data, language='en-US')
            return text
        except sr.UnknownValueError:
            print("🔇 Could not understand the audio")
            return None
        except sr.RequestError as e:
            print(f"⚠️ Speech recognition service error: {e}")
            return None

# Create backward-compatible AudioInput class
class AudioInput(EnhancedAudioInput):
    """Backward compatible wrapper for existing code."""
    pass

class PlutoWalletAssistant:
    """Main application class for Pluto wallet assistant"""
    
    def __init__(self):
        """Initialize Pluto with all required components"""
        # Initialize components
        self.audio = AudioInput()
        
        # Session tracking
        self.session_file = os.path.join(os.path.dirname(__file__), "user_session.json")
        self.session_data = self.load_session_data()
        
        print("🚀 Pluto Wallet Assistant initialized successfully!")
        print("💰 Ethereum wallet functionality enabled")
    
    def load_session_data(self):
        """Load user session data to track first-time usage"""
        try:
            if os.path.exists(self.session_file):
                with open(self.session_file, 'r') as f:
                    return json.load(f)
            else:
                # First time user
                return {
                    "is_first_time": True,
                    "total_sessions": 0,
                    "last_visit": None,
                    "user_preferences": {}
                }
        except Exception as e:
            print(f"Warning: Could not load session data: {e}")
            return {"is_first_time": True, "total_sessions": 0, "last_visit": None, "user_preferences": {}}
    
    def save_session_data(self):
        """Save session data"""
        try:
            self.session_data["total_sessions"] += 1
            self.session_data["last_visit"] = time.strftime("%Y-%m-%d %H:%M:%S")
            self.session_data["is_first_time"] = False
            
            with open(self.session_file, 'w') as f:
                json.dump(self.session_data, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not save session data: {e}")
    
    def get_personalized_greeting(self):
        """Get appropriate greeting based on user history"""
        if self.session_data["is_first_time"]:
            return (
                "Welcome to Pluto! I'm excited to meet you for the first time. "
                "I'm your AI-powered crypto companion, designed to help you navigate "
                "the world of Ethereum and DeFi with confidence and security. "
                "I can help you create wallets, check balances, send transactions, "
                "and even send test tokens to practice safely. "
                "Let's start your crypto journey together! "
                "Say 'hey pluto' followed by what you'd like to do."
            )
        else:
            sessions = self.session_data["total_sessions"]
            if sessions < 5:
                return (
                    f"Welcome back! This is our {sessions + 1} session together. "
                    "I'm Pluto, your crypto companion. Ready to continue exploring "
                    "Ethereum and DeFi? Say 'hey pluto' followed by your command."
                )
            else:
                return (
                    "Hey there! Pluto here, ready to help with your crypto needs. "
                    "Whether it's checking balances, making transactions, or testing "
                    "with test tokens, I've got you covered. Say 'hey pluto' to start."
                )
        
    def start_voice_session(self):
        """Start the voice interaction session"""
        print("\n🎤 Voice interaction mode activated")
        print("Say 'hey pluto' to start speaking...")
        print("Available commands:")
        print("  • 'create wallet' or 'new wallet'")
        print("  • 'check balance' or 'my balance'")
        print("  • 'send X ETH to [address]'")
        print("  • 'send test tokens' or 'test transaction'")
        print("  • 'confirm transaction [id]'")
        print("Say 'exit' to quit")
        print("=" * 60)
        
        # Get personalized greeting
        intro = self.get_personalized_greeting()
        print(f"🤖 Pluto: {intro}")
        # self.tts.speak(intro)  # Uncomment if you have TTS
        
        # Save session data after greeting
        self.save_session_data()
        
        while True:
            try:
                # Listen for wake word with enhanced detection
                print("🎤 Waiting for wake word...")
                wake_detected = self.audio.listen_for_wake_word(["hey pluto", "hepluto", "play pluto", "pluto"])
                
                if wake_detected:
                    print("🎤 Wake word detected. Start speaking...")
                    
                    # Listen for command
                    audio_data = self.audio.listen_until_silence()
                    text = self.audio.transcribe(audio_data)
                    
                    if text:
                        print(f"👤 You said: {text}")
                        
                        # Check for exit
                        if any(exit_word in text.lower() for exit_word in ['exit', 'quit', 'goodbye', 'stop']):
                            farewell = "Goodbye! It's been great helping you with your crypto journey. Stay safe with your transactions, and I'll be here whenever you need me!"
                            print(f"🤖 Pluto: {farewell}")
                            # self.tts.speak(farewell)  # Uncomment if you have TTS
                            break
                        
                        # Process with GPT (placeholder - add your GPT client here)
                        print(f"🔄 Processing: {text}")
                        response = f"I heard you say: {text}. This is where I would process your crypto command!"
                        print(f"🤖 Pluto: {response}")
                        # self.tts.speak(response)  # Uncomment if you have TTS
                        
                    else:
                        print("🔇 Didn't catch that. Waiting for wake word...")
                
                print("-" * 40)
                
            except KeyboardInterrupt:
                print("\n\n👋 Session ended by user")
                break
            except Exception as e:
                error_msg = f"Sorry, I encountered an error: {str(e)}"
                print(f"❌ Error: {error_msg}")
                # self.tts.speak("Sorry, I encountered an error. Please try again.")

def filter_sensitive_info_for_voice(response):
    """Filter out sensitive information from voice responses"""
    # Convert to string if it's a dict or other type
    if not isinstance(response, str):
        response = str(response)
    
    voice_response = response
    
    # Remove Ethereum addresses
    voice_response = re.sub(r'0x[a-fA-F0-9]{40}', '[wallet address]', voice_response)
    
    # Remove private keys (if any somehow appear)
    voice_response = re.sub(r'0x[a-fA-F0-9]{64}', '[private key hidden]', voice_response)
    
    # Remove mnemonic phrases (12-24 words)
    voice_response = re.sub(r'(?:\w+\s+){11}\w+', '[mnemonic phrase hidden]', voice_response)
    
    # Remove transaction hashes
    voice_response = re.sub(r'Transaction Hash: 0x[a-fA-F0-9]+', 'Transaction Hash: [hidden]', voice_response)
    
    # Remove specific address mentions in messages
    voice_response = re.sub(r'Address: 0x[a-fA-F0-9]{40}', 'Address: [wallet address]', voice_response)
    
    # Remove explorer URLs
    voice_response = re.sub(r'https://etherscan.io/tx/0x[a-fA-F0-9]+', '[explorer link available]', voice_response)
    
    # Clean up multiple spaces
    voice_response = re.sub(r'\s+', ' ', voice_response).strip()
    
    return voice_response

def main():
    """Enhanced voice-only mode with robust wake word detection"""
    
    # Initialize audio with enhanced detection
    audio = AudioInput()
    
    # Session tracking
    session_file = os.path.join(os.path.dirname(__file__), "user_session.json")
    
    def load_session_data():
        try:
            if os.path.exists(session_file):
                with open(session_file, 'r') as f:
                    return json.load(f)
            else:
                return {
                    "is_first_time": True,
                    "total_sessions": 0,
                    "last_visit": None,
                    "user_preferences": {}
                }
        except Exception as e:
            return {"is_first_time": True, "total_sessions": 0, "last_visit": None, "user_preferences": {}}
    
    def save_session_data(session_data):
        try:
            session_data["total_sessions"] += 1
            session_data["last_visit"] = time.strftime("%Y-%m-%d %H:%M:%S")
            session_data["is_first_time"] = False
            
            with open(session_file, 'w') as f:
                json.dump(session_data, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not save session data: {e}")
    
    def get_personalized_greeting(session_data):
        if session_data["is_first_time"]:
            return (
                "Welcome to Pluto! I'm thrilled to meet you for the first time. "
                "I'm your AI-powered crypto companion, designed to help you navigate "
                "the world of Ethereum and DeFi with confidence and security. "
                "I can help you create wallets, check balances, send transactions, "
                "and even send test tokens to practice safely. "
                "Let's start your crypto journey together!"
            )
        else:
            sessions = session_data["total_sessions"]
            if sessions < 5:
                return (
                    f"Welcome back! This is our {sessions + 1} session together. "
                    "I'm Pluto, your crypto companion. Ready to continue exploring "
                    "Ethereum and DeFi? I'm here to help with real transactions or "
                    "test token practice sessions."
                )
            else:
                return (
                    "Hey there! Pluto here, ready to help with your crypto needs. "
                    "Whether it's checking balances, making transactions, or testing "
                    "with test tokens, I've got you covered."
                )

    # Load session data
    session_data = load_session_data()

    print("🎤 Pluto Wallet Assistant - Enhanced Voice Mode")
    print("💰 Ethereum wallet functionality enabled")
    print("🧪 Test token system available for safe practice")
    print("🔒 Sensitive information will be shown in logs only (not spoken)")
    print("✨ Enhanced wake word detection active!")
    print("Say any of these to wake Pluto:")
    print("  • 'hey pluto' or 'hepluto'")
    print("  • 'play pluto' or just 'pluto'")
    print("  • Even works with variations like 'hey blue toe' or 'hey fluto'!")
    print("=" * 70)
    
    # Get and speak personalized greeting
    greeting = get_personalized_greeting(session_data)
    print(f"🤖 Pluto: {greeting}")
    # tts.speak(greeting)  # Uncomment if you have TTS
    
    # Save session data
    save_session_data(session_data)
    
    # Enhanced wake word detection
    print("🎤 Listening for wake word with smart detection...")
    wake_detected = audio.listen_for_wake_word(["hey pluto", "hepluto", "play pluto", "pluto"])
    
    if wake_detected:
        print("🎉 Wake word detected! Pluto is now active. Start speaking...")
        print("Available commands:")
        print("  • 'create wallet' or 'new wallet'")
        print("  • 'check balance' or 'my balance'")
        print("  • 'send X ETH to [address]'")
        print("  • 'send test tokens' or 'test transaction'")
        print("  • 'practice mode' or 'help me learn'")
        print("  • 'confirm transaction [id]'")
        print("Say 'exit', 'quit', or 'goodbye' to stop")
        print("=" * 60)
        
        # Continuous listening loop after wake word
        while True:
            try:
                audio_data = audio.listen_until_silence()
                text = audio.transcribe(audio_data)
                if text:
                    print(f"👤 You said: {text}")
                    
                    # Check for exit commands
                    if any(exit_word in text.lower() for exit_word in ['exit', 'quit', 'goodbye', 'stop']):
                        farewell = "Goodbye! It's been wonderful helping you with your crypto journey. Stay safe with your transactions, and remember - I'm here whenever you need me!"
                        print(f"🤖 Pluto: {farewell}")
                        # tts.speak(farewell)  # Uncomment if you have TTS
                        break
                    
                    # Check for help requests
                    if any(help_word in text.lower() for help_word in ['help', 'what can you do', 'commands', 'options']):
                        help_response = (
                            "I can help you with many things! You can ask me to create wallets, "
                            "check balances, send real transactions, or practice with test tokens. "
                            "Try saying 'send test tokens' to practice safely, or 'create new wallet' to get started. "
                            "I'm also great at explaining DeFi concepts and crypto strategies!"
                        )
                        print(f"🤖 Pluto: {help_response}")
                        # tts.speak(help_response)  # Uncomment if you have TTS
                        print("✅ Ready for next input...")
                        print("-" * 40)
                        continue
                    
                    print(f"🔄 Processing: {text}")
                    
                    # Placeholder for GPT processing
                    # Replace this with your actual GPT client call
                    full_response = f"I received your command: '{text}'. This is where I would process your crypto request using GPT!"
                    
                    # Filter response for voice (remove sensitive info)
                    voice_response = filter_sensitive_info_for_voice(full_response)
                    
                    # Show full response in logs (with sensitive info)
                    print(f"🤖 Pluto (Full Log): {full_response}")
                    print(f"🔊 Pluto (Voice): {voice_response}")
                    
                    # Only speak the filtered response
                    # tts.speak(voice_response)  # Uncomment if you have TTS
                    print("✅ Ready for next input...")
                    print("-" * 40)
                else:
                    # More encouraging message for failed recognition
                    print("🔇 I didn't catch that clearly. Please speak again - I'm listening!")
                    encouragement = "I didn't catch that clearly. Please try speaking again - I'm here and listening!"
                    # tts.speak(encouragement)  # Uncomment if you have TTS
            except KeyboardInterrupt:
                print("\n\n👋 Session ended by user")
                break
            except Exception as e:
                error_msg = f"Sorry, I encountered an error: {str(e)}"
                print(f"❌ Error: {error_msg}")
                # tts.speak("Sorry, I encountered an error. Please try again - I'm still here to help!")
    else:
        print("❌ No wake word detected. Exiting...")

if __name__ == "__main__":
    import requests
    import json
    
    audio = AudioInput()
    print("🎤 Pluto Voice Assistant - Wallet Integration Active")
    print("💰 Connected to RPI server at http://localhost:3000")
    print("🔊 Say 'Hey Pluto' to wake the assistant.")
    print("\n💡 Try these wallet commands:")
    print("  • 'create wallet' or 'generate new wallet'")
    print("  • 'what is my wallet' or 'show my wallets'") 
    print("  • 'check my balance' or 'what's my balance'")
    print("  • 'what is the price of ethereum'")
    print("  • 'show my portfolio value'")
    print("=" * 60)
    
    while True:
        try:
            # Enhanced wake word detection - will detect all variations
            woke = audio.listen_for_wake_word(["hey pluto"])
            if woke:
                print("\n🟢 Wake word detected! Start speaking...")
                audio_data = audio.listen_until_silence()
                text = audio.transcribe(audio_data)
                
                if text:
                    print(f"👤 You said: {text}")
                    
                    # Check for exit commands first
                    if any(exit_word in text.lower() for exit_word in ['exit', 'quit', 'goodbye', 'stop']):
                        print("👋 Exiting Pluto Assistant...")
                        break
                    
                    try:
                        # Send to RPI server API
                        url = "http://localhost:3000/"
                        payload = {"text": text}
                        
                        print("🔄 Processing with Pluto AI...")
                        response = requests.post(url, json=payload, timeout=30)
                        
                        if response.status_code == 200:
                            result = response.json()
                            
                            if result.get('success'):
                                pluto_response = result.get('pluto_response', 'I processed your request.')
                                print(f"🤖 Pluto: {pluto_response}")
                                
                                # Show additional info if available
                                if 'action_performed' in result:
                                    action = result['action_performed']
                                    print(f"✅ Action: {action}")
                                    
                                    # Show wallet info if created
                                    if action == 'CREATE_WALLET' and 'wallet' in result:
                                        wallet = result['wallet']
                                        print(f"🏦 New Wallet Address: {wallet['address']}")
                                        print("💡 Your wallet details have been saved securely.")
                                    
                                    # Show balance info
                                    elif action == 'GET_WALLET_BALANCE' and 'balance_data' in result:
                                        balance_data = result['balance_data']
                                        if balance_data:
                                            print("💰 Balance Information:")
                                            for wallet_balance in balance_data:
                                                address = wallet_balance.get('address', 'Unknown')[:10] + "..."
                                                eth_balance = wallet_balance.get('eth_balance', '0')
                                                print(f"  📍 {address}: {eth_balance} ETH")
                                    
                                    # Show token price info
                                    elif action == 'GET_TOKEN_PRICE' and 'token_data' in result:
                                        token_data = result['token_data']
                                        if token_data:
                                            symbol = token_data.get('symbol', 'Token')
                                            price = token_data.get('price_usd', 'N/A')
                                            print(f"💲 {symbol} Price: ${price}")
                                
                            else:
                                error_msg = result.get('message', 'Unknown error occurred')
                                print(f"❌ Error: {error_msg}")
                        
                        else:
                            print(f"❌ Server error: {response.status_code}")
                            print("🔧 Make sure the RPI server is running on http://localhost:3000")
                    
                    except requests.exceptions.ConnectionError:
                        print("❌ Connection failed: RPI server not responding")
                        print("🔧 Please start the RPI server: npm run dev")
                        print("💡 Falling back to basic response...")
                        print(f"🤖 I heard: '{text}' but couldn't process it right now.")
                    
                    except requests.exceptions.Timeout:
                        print("⏰ Request timed out - server is taking too long to respond")
                        
                    except Exception as api_err:
                        print(f"❌ API call failed: {api_err}")
                        print(f"🤖 I heard: '{text}' but encountered an error processing it.")
                
                else:
                    print("🔇 Didn't catch that clearly. Try speaking again...")
                
                print("-" * 40)
                print("🎤 Listening for 'Hey Pluto'...")
                
        except KeyboardInterrupt:
            print("\n👋 Session ended by user.")
            break
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            print("🔄 Restarting voice detection...")
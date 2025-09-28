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
from typing import List, Optional, Tuple

from utils.display import show_display_message
from config import config

# Add the project path
sys.path.append(os.path.dirname(__file__))

class EnhancedAudioInput:
    """Enhanced Audio Input with robust wake word detection."""
    
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        
        # Optimize settings for wake word detection (using config)
        self.recognizer.energy_threshold = config.energy_threshold
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = config.pause_threshold
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
        
        # Minimum confidence threshold (using config)
        self.wake_threshold = config.wake_threshold
        
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

    def listen_until_silence(self, timeout: int = 3000) -> Optional[sr.AudioData]:
        """Listen for audio until silence is detected."""
        try:
            with self.microphone as source:
                print("🎤 Listening for command... (speak now)")
                audio = self.recognizer.listen(source, timeout=timeout, phrase_time_limit=3000)
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
                    show_display_message({"emotion": "wave", "text": "Listening!.."})
                    # Listen for command
                    audio_data = self.audio.listen_until_silence()
                    text = self.audio.transcribe(audio_data)
                    
                    if text:
                        print(f"👤 You said: {text}")
                        show_display_message()
                        
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

class PlutoEnhancedSession:
    """Enhanced session manager with conversation flow"""
    
    def __init__(self):
        import requests
        self.requests = requests
        self.audio = AudioInput()
        self.api_url = config.rpi_server_url
        self.session_id = f"pluto_{int(time.time())}"
        self.session_active = False
        self.last_interaction = time.time()
        self.conversation_timeout = config.session_timeout_seconds
        # Command processing state
        self.processing_command = False
        self.current_operation = None
        self.can_cancel = False
        
    def is_conversation_active(self):
        """Check if we're in an active conversation"""
        return self.session_active and (time.time() - self.last_interaction) < self.conversation_timeout
    
    def start_conversation(self):
        """Start a new conversation session"""
        self.session_active = True
        self.last_interaction = time.time()
        self.processing_command = False
        self.current_operation = None
        print(f"🎯 Conversation started (Session: {self.session_id})")
        show_display_message({"emotion": "excited", "text": "Ready to chat!", "duration": 3})
        
    def end_conversation(self):
        """End the conversation session"""
        if self.session_active:
            print("🎯 Conversation ended")
            show_display_message({"emotion": "normal", "text": "Goodbye!", "duration": 3})
            try:
                self.requests.post(f"{self.api_url}session/{self.session_id}/end", timeout=3)
            except:
                pass
        self.session_active = False
        self.processing_command = False
        self.current_operation = None
        self.can_cancel = False
        
    def update_last_interaction(self):
        """Update the last interaction time"""
        self.last_interaction = time.time()
    
    def is_cancel_command(self, text: str) -> bool:
        """Check if the user wants to cancel the current operation"""
        if not text:
            return False
        
        text_lower = text.lower().strip()
        cancel_phrases = [
            'cancel', 'stop', 'no', 'abort', 'quit this', 'stop this',
            'never mind', 'forget it', 'cancel that', 'stop that',
            'no thanks', 'not now', 'cancel operation', 'stop operation'
        ]
        
        return any(phrase in text_lower for phrase in cancel_phrases)
    
    def start_command_processing(self, operation_name: str):
        """Mark that we're starting to process a command"""
        self.processing_command = True
        self.current_operation = operation_name
        self.can_cancel = True
        print(f"🔄 Starting operation: {operation_name}")
        show_display_message({"emotion": "confused", "text": f"Working on {operation_name}..."})
    
    def finish_command_processing(self):
        """Mark that command processing is complete"""
        self.processing_command = False
        self.current_operation = None
        self.can_cancel = False
        print("✅ Operation completed")
    
    def cancel_current_operation(self):
        """Cancel the current operation"""
        if self.processing_command and self.can_cancel:
            operation = self.current_operation or "operation"
            print(f"❌ Cancelled: {operation}")
            show_display_message({"emotion": "sad", "text": "Cancelled", "duration": 3})
            self.finish_command_processing()
            return True
        return False
        
    def send_to_server(self, text: str):
        """Send text to server with session context"""
        # Extract operation name for tracking
        operation_name = "command"
        text_lower = text.lower()
        
        if any(word in text_lower for word in ['create', 'new', 'generate']):
            if 'wallet' in text_lower:
                operation_name = "wallet creation"
        elif any(word in text_lower for word in ['send', 'transfer', 'pay']):
            operation_name = "transaction"
        elif any(word in text_lower for word in ['balance', 'check']):
            operation_name = "balance check"
        elif any(word in text_lower for word in ['buy', 'sell', 'trade']):
            operation_name = "trading"
        
        # Mark command processing start
        self.start_command_processing(operation_name)
        
        payload = {
            "text": text,
            "sessionId": self.session_id,
            "continueSession": self.session_active
        }
        
        try:
            response = self.requests.post(self.api_url, json=payload, timeout=config.request_timeout_seconds)
            if response.status_code == 200:
                data = response.json()
                self.session_active = data.get('continue_listening', False)
                self.finish_command_processing()
                return data
            else:
                print(f"Server error: {response.status_code}")
                self.finish_command_processing()
                return {"success": False, "pluto_response": "Server error occurred"}
        except Exception as api_err:
            print(f"API call failed: {api_err}")
            self.finish_command_processing()
            return {"success": False, "pluto_response": "Connection error occurred"}
    
    def run_conversation_loop(self):
        """Run the continuous conversation loop"""
        print("🎤 Enhanced Pluto Assistant - Single Command Mode Active")
        print("💫 Say 'Hey Pluto' once to start a conversation")
        print("🔄 I will process ONE command at a time - no interruptions!")
        print("❌ Say 'cancel', 'stop', or 'no' to cancel current operations")
        print("🛑 Say 'goodbye', 'exit', or wait 5 minutes to end session")
        print("=" * 70)
        
        while True:
            try:
                if not self.is_conversation_active():
                    # Need wake word to start conversation
                    print("🎤 Waiting for wake word...")
                    show_display_message({"emotion": "normal", "text": "Say Hey Pluto"})
                    
                    woke = self.audio.listen_for_wake_word(["hey pluto"])
                    if woke:
                        self.start_conversation()
                        continue
                else:
                    # Check if we're currently processing a command
                    if self.processing_command:
                        print(f"⏳ Still processing: {self.current_operation}...")
                        print("🎤 Say 'cancel' or 'stop' to cancel, or wait for completion...")
                        show_display_message({
                            "emotion": "confused", 
                            "text": f"Processing {self.current_operation}...",
                            "duration": 3
                        })
                        
                        # Listen for cancel commands only
                        audio_data = self.audio.listen_until_silence()
                        text = self.audio.transcribe(audio_data)
                        
                        if text:
                            print(f"👤 You said: {text}")
                            
                            if self.is_cancel_command(text):
                                if self.cancel_current_operation():
                                    print("✅ Operation cancelled successfully!")
                                else:
                                    print("ℹ️ Nothing to cancel right now")
                            else:
                                print(f"⚠️ Command ignored - still processing '{self.current_operation}'")
                                print("💡 Say 'cancel' to stop, or wait for current operation to finish")
                                show_display_message({
                                    "emotion": "confused", 
                                    "text": "Still busy...",
                                    "duration": 2
                                })
                        continue
                    
                    # Not processing - ready for new commands
                    print("🎤 Listening for new command...")
                    show_display_message({"emotion": "wave", "text": "Listening..."})
                    
                    audio_data = self.audio.listen_until_silence()
                    text = self.audio.transcribe(audio_data)
                    
                    if text:
                        print(f"👤 You said: {text}")
                        self.update_last_interaction()
                        
                        # Check for conversation end commands first
                        if any(exit_word in text.lower() for exit_word in ['exit', 'quit', 'goodbye', 'stop session']):
                            self.end_conversation()
                            continue
                        
                        # Check if it's just a cancel command without active operation
                        if self.is_cancel_command(text) and not self.processing_command:
                            print("ℹ️ Nothing to cancel right now. Ready for your command!")
                            show_display_message({"emotion": "normal", "text": "Ready!", "duration": 2})
                            continue
                        
                        # Process the command (this will set processing_command = True)
                        print(f"🔄 Processing your request: {text}")
                        response_data = self.send_to_server(text)
                        
                        if response_data.get("success"):
                            pluto_response = response_data.get("pluto_response", "")
                            print(f"🤖 Pluto: {pluto_response}")
                            
                            # Show display message if provided
                            display_msg = response_data.get("display_message")
                            if display_msg:
                                show_display_message({
                                    "emotion": "happy", 
                                    "text": display_msg,
                                    "duration": 8
                                })
                            else:
                                show_display_message({"emotion": "happy", "text": "✓"})
                            
                            # Check if conversation should continue
                            if not response_data.get("continue_listening", True):
                                self.end_conversation()
                                
                        else:
                            error_msg = response_data.get("pluto_response", "Something went wrong")
                            print(f"❌ Error: {error_msg}")
                            show_display_message({"emotion": "sad", "text": "Error"})
                            
                        print("✅ Ready for next command!")
                        print("-" * 40)
                            
                    else:
                        # No speech detected - show gentle prompt
                        if self.is_conversation_active():
                            show_display_message({"emotion": "normal", "text": "Still listening..."})
                        
            except KeyboardInterrupt:
                print("\n\n👋 Session ended by user")
                self.end_conversation()
                break
            except Exception as e:
                print(f"❌ Unexpected error: {e}")
                # Reset processing state on error
                self.finish_command_processing()
                time.sleep(1)


if __name__ == "__main__":
    session = PlutoEnhancedSession()
    session.run_conversation_loop()
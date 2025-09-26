"""
Pluto - AI-Powered Ethereum Wallet Assistant
A production-ready voice-controlled cryptocurrency wallet system.
"""

import os
import sys
import time
import json
from dotenv import load_dotenv

# Add the project path
sys.path.append(os.path.dirname(__file__))

from input.audio_input import AudioInput

# Load environment variables
load_dotenv()

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
        self.tts.speak(intro)
        
        # Save session data after greeting
        self.save_session_data()
        
        while True:
            try:
                # Listen for wake word
                self.audio.listen_for_wake_word(["hey pluto", "hepluto"])
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
                        self.tts.speak(farewell)
                        break
                    
                    # Process with GPT
                    print(f"🔄 Processing: {text}")
                    response = self.gpt_client.get_response(text)
                    print(f"🤖 Pluto: {response}")
                    self.tts.speak(response)
                    
                else:
                    print("🔇 Didn't catch that. Waiting for wake word...")
                
                print("-" * 40)
                
            except KeyboardInterrupt:
                print("\n\n👋 Session ended by user")
                break
            except Exception as e:
                error_msg = f"Sorry, I encountered an error: {str(e)}"
                print(f"❌ Error: {error_msg}")
                self.tts.speak("Sorry, I encountered an error. Please try again.")
    
    def start_text_session(self):
        """Start a text-only session"""
        print("\n💬 Text interaction mode activated")
        print("Available commands:")
        print("  • 'create wallet' or 'new wallet'")
        print("  • 'check balance' or 'my balance'")
        print("  • 'send X ETH to [address]'")
        print("  • 'send test tokens' or 'test transaction'")
        print("  • 'confirm transaction [id]'")
        print("Type 'exit' to quit")
        print("=" * 60)
        
        # Show personalized greeting
        intro = self.get_personalized_greeting()
        print(f"🤖 Pluto: {intro}")
        
        # Save session data after greeting
        self.save_session_data()
        
        while True:
            try:
                user_input = input("\n👤 You: ").strip()
                
                if not user_input:
                    continue
                
                # Check for exit
                if user_input.lower() in ['exit', 'quit', 'goodbye', 'stop']:
                    print("🤖 Pluto: Goodbye! It's been great helping you with your crypto journey. Stay safe with your transactions, and I'll be here whenever you need me!")
                    break
                
                # Process command
                response = self.gpt_client.get_response(user_input)
                print(f"🤖 Pluto: {response}")
                
            except KeyboardInterrupt:
                print("\n\n👋 Session ended by user")
                break
            except Exception as e:
                print(f"❌ Error: {str(e)}")

def main():
    """Enhanced voice-only mode with personalized greetings and test tokens"""
    config = Config()
    audio = AudioInput()
    gpt = GPTClient(config.openai_api_key, config.ethereum_rpc_url)
    tts = TextToSpeech()

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
    print("Say 'hey pluto' to start speaking...")
    
    # Get and speak personalized greeting
    greeting = get_personalized_greeting(session_data)
    print(f"🤖 Pluto: {greeting}")
    tts.speak(greeting)
    
    # Save session data
    save_session_data(session_data)
    
    # Wait for initial wake word
    audio.listen_for_wake_word(["hey pluto", "hepluto", "play pluto", "pluto"])
    print("Wake word detected! Pluto is now active. Start speaking...")
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
                    tts.speak(farewell)
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
                    tts.speak(help_response)
                    print("✅ Ready for next input...")
                    print("-" * 40)
                    continue
                
                print(f"🔄 Processing: {text}")
                
                # Get response from GPT with secure filtering
                full_response = gpt.get_response(text)
                
                # Filter response for voice (remove sensitive info)
                voice_response = filter_sensitive_info_for_voice(full_response)
                
                # Show full response in logs (with sensitive info)
                print(f"🤖 Pluto (Full Log): {full_response}")
                print(f"🔊 Pluto (Voice): {voice_response}")
                
                # Only speak the filtered response
                tts.speak(voice_response)
                print("✅ Ready for next input...")
                print("-" * 40)
            else:
                # More encouraging message for failed recognition
                print("🔇 I didn't catch that clearly. Please speak again - I'm listening!")
                encouragement = "I didn't catch that clearly. Please try speaking again - I'm here and listening!"
                tts.speak(encouragement)
        except KeyboardInterrupt:
            print("\n\n👋 Session ended by user")
            break
        except Exception as e:
            error_msg = f"Sorry, I encountered an error: {str(e)}"
            print(f"❌ Error: {error_msg}")
            tts.speak("Sorry, I encountered an error. Please try again - I'm still here to help!")

def filter_sensitive_info_for_voice(response):
    """Filter out sensitive information from voice responses"""
    import re
    
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

if __name__ == "__main__":
    import requests
    audio = AudioInput()
    print("Say 'Hey Pluto' to wake the assistant.")
    while True:
        try:
            # Only wake on 'hey pluto', ignore everything else
            woke = audio.listen_for_wake_word(["hey pluto"])
            if woke:
                print("Wake word detected! Start speaking...")
                audio_data = audio.listen_until_silence()
                text = audio.transcribe(audio_data)
                if text:
                    print(f"You said: {text}")
                    url = "http://localhost:3000/"  # Placeholder
                    payload = {"text": text}
                    try:
                        response = requests.post(url, json=payload)
                        print(f"API response: {response.text}")
                    except Exception as api_err:
                        print(f"API call failed: {api_err}")
                    if any(exit_word in text.lower() for exit_word in ['exit', 'quit', 'goodbye', 'stop']):
                        print("Exiting...")
                        break
                # After response, immediately go back to listening for wake word
                # If text is None, don't print anything, just keep listening
        except KeyboardInterrupt:
            print("\nSession ended by user.")
            break

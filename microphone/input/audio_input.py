import speech_recognition as sr
import numpy as np
try:
    from .voice_recognition import VoiceRecognition
except ImportError:
    # Fallback for when voice recognition dependencies aren't available
    VoiceRecognition = None

class AudioInput:
    def __init__(self, enable_voice_auth=True, user_id="default_user"):
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        self.enable_voice_auth = enable_voice_auth
        self.user_id = user_id
        
        # Initialize voice recognition if available and enabled
        self.voice_recognition = None
        if enable_voice_auth and VoiceRecognition:
            try:
                self.voice_recognition = VoiceRecognition()
                print("✅ Voice authentication enabled")
            except Exception as e:
                print(f"⚠️  Voice authentication disabled: {e}")
                self.enable_voice_auth = False
        elif enable_voice_auth:
            print("⚠️  Voice authentication disabled: dependencies not available")
            self.enable_voice_auth = False
        
        # Custom crypto vocabulary correction mapping
        self.corrections = {
            "unicef": "uniswap",
            "you n swap": "uniswap",
            "uni swap": "uniswap",
            "a wave": "aave",
            "a way":"aave",
            "pyth": "pyth network",
            "flow":" flow blockchain",
            "hedera":"hedera EVM",
            "sol":"solana",
            "1 inch": "1inch",
            "one inch": "1inch",
            "curve fi": "curve finance",
            "root sock":"rootstock",
            "poly agon": "polygon",
            "poly gan": "polygon",
            "poly gone": "polygon",
            "matic":"polygon",
            "avalanche":"avalanche",
            "ava lanche":"avalanche",
            "ava lanch":"avalanche",
            "a lanch": "avalanche",
            "file con":"filecoin",
            "file coin":"filecoin",
            "file con":"filecoin",
            "the grpaph": "the graph",
            "the graph":"the graph",
            "graph":"the graph",
            "wal rus":"walrus",
            "walrus":"walrus",
            "ave": "aave",
            "lidoh": "lido",
            "curb finance": "curve finance",
            "make a dao": "makerdao",
            "sushiswap": "sushi swap"
        }

    def apply_corrections(self, text: str) -> str:
        if not text:
            return text
        for wrong, correct in self.corrections.items():
            if wrong in text.lower():
                text = text.lower().replace(wrong, correct)
        return text

    def listen_for_wake_word(self, wake_words=["hey pluto", "hepluto"], timeout=None):
        print(f"Say 'Hey Pluto' to start...")
        while True:
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source)
                audio = self.recognizer.listen(source, timeout=timeout, phrase_time_limit=3)
            try:
                text = self.recognizer.recognize_google(audio).lower()
                text = self.apply_corrections(text)
                print(f"Heard: {text}")
                for word in wake_words:
                    if word in text:
                        print("Wake word detected!")
                        return True
            except sr.UnknownValueError:
                continue
            except Exception as e:
                print(f"Wake word error: {e}")
                continue

    def listen_until_silence(self, max_silence=3, max_duration=20):
        print("Listening for speech...")
        with self.microphone as source:
            self.recognizer.adjust_for_ambient_noise(source)
            audio = self.recognizer.listen(source, timeout=None, phrase_time_limit=max_duration)
        return audio

    def listen(self, phrase_time_limit=10):
        with self.microphone as source:
            self.recognizer.adjust_for_ambient_noise(source)
            print("Listening...")
            audio = self.recognizer.listen(source, phrase_time_limit=phrase_time_limit)
        return audio

    def transcribe(self, audio):
        try:
            text = self.recognizer.recognize_google(audio)
            text = self.apply_corrections(text)
            return text
        except sr.UnknownValueError:
            return None
        except Exception as e:
            print(f"AudioInput error: {e}")
            return None
    
    def verify_speaker(self, audio) -> bool:
        """
        Verify if the speaker in the audio matches the enrolled voice profile.
        
        Args:
            audio: Audio data from speech_recognition
            
        Returns:
            True if voice is verified or voice auth is disabled, False otherwise
        """
        if not self.enable_voice_auth or not self.voice_recognition:
            return True  # Allow if voice auth is disabled
        
        try:
            # Convert speech_recognition audio to numpy array
            audio_data = np.frombuffer(audio.get_raw_data(), dtype=np.int16).astype(np.float32)
            audio_data = audio_data / np.max(np.abs(audio_data))  # Normalize
            
            is_verified, similarity = self.voice_recognition.verify_voice(audio_data, self.user_id)
            
            if not is_verified:
                print(f"🚫 Voice verification failed for user '{self.user_id}'")
                print(f"📊 Similarity: {similarity:.3f} (threshold: {self.voice_recognition.threshold})")
            
            return is_verified
            
        except Exception as e:
            print(f"❌ Voice verification error: {e}")
            return False
    
    def listen_with_voice_auth(self, phrase_time_limit=10):
        """
        Listen for audio and verify speaker identity before returning.
        
        Args:
            phrase_time_limit: Maximum time to listen for speech
            
        Returns:
            Audio data if voice is verified, None otherwise
        """
        audio = self.listen(phrase_time_limit)
        
        if audio is None:
            return None
        
        if not self.verify_speaker(audio):
            print("🚫 Access denied: Voice verification failed")
            return None
        
        print("✅ Voice verified - processing command")
        return audio
    
    def transcribe_with_voice_auth(self, audio=None, phrase_time_limit=10):
        """
        Listen and transcribe with voice verification.
        
        Args:
            audio: Optional pre-recorded audio, if None will listen from microphone
            phrase_time_limit: Maximum time to listen if audio is None
            
        Returns:
            Transcribed text if voice is verified, None otherwise
        """
        if audio is None:
            audio = self.listen_with_voice_auth(phrase_time_limit)
            if audio is None:
                return None
        else:
            # Verify provided audio
            if not self.verify_speaker(audio):
                print("🚫 Access denied: Voice verification failed")
                return None
        
        return self.transcribe(audio)
    
    def setup_voice_profile(self):
        """
        Setup voice profile for the current user.
        
        Returns:
            True if setup successful, False otherwise
        """
        if not VoiceRecognition:
            print("❌ Voice recognition not available - missing dependencies")
            return False
        
        if not self.voice_recognition:
            try:
                self.voice_recognition = VoiceRecognition()
            except Exception as e:
                print(f"❌ Failed to initialize voice recognition: {e}")
                return False
        
        print(f"🎯 Setting up voice profile for user: {self.user_id}")
        success = self.voice_recognition.enroll_voice(self.user_id)
        
        if success:
            self.enable_voice_auth = True
            print("✅ Voice profile setup completed")
        else:
            print("❌ Voice profile setup failed")
        
        return success
    
    def check_voice_profile_exists(self) -> bool:
        """
        Check if a voice profile exists for the current user.
        
        Returns:
            True if profile exists, False otherwise
        """
        if not self.voice_recognition:
            return False
        
        profiles = self.voice_recognition.list_voice_profiles()
        return self.user_id in profiles
    
    def set_voice_auth_enabled(self, enabled: bool):
        """
        Enable or disable voice authentication.
        
        Args:
            enabled: Whether to enable voice authentication
        """
        if enabled and not VoiceRecognition:
            print("❌ Cannot enable voice auth: dependencies not available")
            return
        
        if enabled and not self.check_voice_profile_exists():
            print(f"❌ Cannot enable voice auth: no profile for user '{self.user_id}'")
            print("💡 Run setup_voice_profile() first")
            return
        
        self.enable_voice_auth = enabled
        status = "enabled" if enabled else "disabled"
        print(f"✅ Voice authentication {status}")
    
    def get_voice_auth_status(self) -> dict:
        """
        Get current voice authentication status.
        
        Returns:
            Dictionary with voice auth status information
        """
        return {
            'enabled': self.enable_voice_auth,
            'available': VoiceRecognition is not None,
            'user_id': self.user_id,
            'profile_exists': self.check_voice_profile_exists(),
            'threshold': self.voice_recognition.threshold if self.voice_recognition else None
        }

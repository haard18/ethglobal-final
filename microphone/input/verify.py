#!/usr/bin/env python3
"""
Simple Voice Verifier
Listens to your voice and checks if you're the same person who recorded earlier.
Also shows what you said via speech-to-text.
"""

import os
import json
import numpy as np
import librosa
import speech_recognition as sr
from typing import Dict, Tuple
import warnings
warnings.filterwarnings("ignore")

class VoiceVerifier:
    def __init__(self, data_file: str = "voice_data.json", threshold: float = 20):
        self.data_file = data_file
        self.threshold = threshold
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        print("🔍 Voice Verifier Ready!")
    
    def extract_voice_features(self, audio_data: np.ndarray) -> Dict:
        """Extract voice features from audio data."""
        try:
            # Ensure audio is float32 and mono
            if len(audio_data.shape) > 1:
                audio_data = np.mean(audio_data, axis=1)
            audio_data = audio_data.astype(np.float32)
            
            # Extract MFCC features (voice characteristics)
            mfcc = librosa.feature.mfcc(y=audio_data, sr=16000, n_mfcc=13)
            mfcc_mean = np.mean(mfcc, axis=1)
            
            # Extract spectral features
            stft = np.abs(librosa.stft(audio_data))
            spectral_centroid = np.mean(librosa.feature.spectral_centroid(S=stft))
            
            # Zero crossing rate (speech patterns)
            zcr = np.mean(librosa.feature.zero_crossing_rate(audio_data))
            
            # RMS energy
            rms = np.mean(librosa.feature.rms(y=audio_data))
            
            return {
                'mfcc_mean': mfcc_mean.tolist(),
                'spectral_centroid': float(spectral_centroid),
                'zcr': float(zcr),
                'rms': float(rms)
            }
        except Exception as e:
            print(f"❌ Error extracting features: {e}")
            return None
    
    def calculate_similarity(self, features1: Dict, features2: Dict) -> float:
        """Calculate similarity between two voice feature sets."""
        try:
            # Compare MFCC features (most important for voice)
            mfcc1 = np.array(features1['mfcc_mean'])
            mfcc2 = np.array(features2['mfcc_mean'])
            mfcc_dist = np.linalg.norm(mfcc1 - mfcc2)
            
            # Compare other features
            spectral_dist = abs(features1['spectral_centroid'] - features2['spectral_centroid']) / 1000
            zcr_dist = abs(features1['zcr'] - features2['zcr'])
            rms_dist = abs(features1['rms'] - features2['rms'])
            
            # Weighted combination
            total_distance = (mfcc_dist * 0.6 + spectral_dist * 0.2 + 
                            zcr_dist * 0.1 + rms_dist * 0.1)
            
            return total_distance
            
        except Exception as e:
            print(f"❌ Error calculating similarity: {e}")
            return 1.0  # Maximum distance on error
    
    def record_and_transcribe(self, duration: int = 3):
        """Record voice, extract features, and transcribe speech."""
        try:
            print(f"\n🎤 Listening for {duration} seconds...")
            print("💬 Speak anything - I'll check if it's you!")
            
            with self.microphone as source:
                # Adjust for ambient noise
                print("🔧 Adjusting for background noise...")
                self.recognizer.adjust_for_ambient_noise(source, duration=1)
                
                print("🔴 Recording now... Speak!")
                # Record audio
                audio = self.recognizer.listen(source, timeout=2, phrase_time_limit=duration)
            
            print("✅ Recording completed!")
            
            # Convert to numpy array for feature extraction
            audio_data = np.frombuffer(audio.get_raw_data(), dtype=np.int16).astype(np.float32)
            audio_data = audio_data / np.max(np.abs(audio_data))  # Normalize
            
            # Extract voice features
            print("🧠 Analyzing voice features...")
            features = self.extract_voice_features(audio_data)
            
            # Transcribe speech
            print("📝 Transcribing speech...")
            try:
                text = self.recognizer.recognize_google(audio)
                print(f"💬 You said: '{text}'")
            except sr.UnknownValueError:
                text = "[Could not understand speech]"
                print("❓ Could not understand what you said")
            except sr.RequestError as e:
                text = "[Speech recognition unavailable]"
                print(f"⚠️ Speech recognition service error: {e}")
            
            return features, text
            
        except sr.WaitTimeoutError:
            print("❌ No speech detected - try speaking louder or closer to microphone")
            return None, None
        except Exception as e:
            print(f"❌ Recording error: {e}")
            return None, None
    
    def load_voice_profiles(self) -> Dict:
        """Load saved voice profiles."""
        if not os.path.exists(self.data_file):
            return {}
        
        try:
            with open(self.data_file, 'r') as f:
                return json.load(f)
        except:
            return {}
    
    def verify_voice(self, user_name: str) -> Tuple[bool, float, str]:
        """Verify if the current speaker matches the saved profile."""
        # Load saved profiles
        profiles = self.load_voice_profiles()
        
        if user_name not in profiles:
            return False, 1.0, "No saved profile found"
        
        # Record current voice
        current_features, transcript = self.record_and_transcribe(duration=3)
        
        if current_features is None:
            return False, 1.0, "Failed to record voice"
        
        # Compare with saved profile
        saved_features = profiles[user_name]['features']
        similarity_score = self.calculate_similarity(saved_features, current_features)
        print(f"🔍 Similarity score: {similarity_score:.3f} (lower is better)")
        # Check if match
        is_match = similarity_score < self.threshold
        
        print(f"\n🔍 VERIFICATION RESULT:")
        print(f"👤 Checking against: {user_name}")
        print(f"📊 Similarity score: {similarity_score:.3f}")
        print(f"🎯 Threshold: {self.threshold}")
        
        if is_match:
            print(f"✅ VERIFIED: This sounds like {user_name}!")
        else:
            print(f"❌ NOT VERIFIED: This doesn't sound like {user_name}")
        
        return is_match, similarity_score, transcript

def main():
    """Main function to verify voice."""
    print("🔍 VOICE VERIFIER")
    print("=" * 40)
    
    verifier = VoiceVerifier()
    
    # Load available profiles
    profiles = verifier.load_voice_profiles()
    
    if not profiles:
        print("❌ No voice profiles found!")
        print("📝 Please run 'record.py' first to create a voice profile")
        return
    
    # Show available profiles
    profile_names = list(profiles.keys())
    print(f"📋 Available profiles: {', '.join(profile_names)}")
    
    # Get user to verify against
    if len(profile_names) == 1:
        user_name = profile_names[0]
        print(f"🎯 Verifying against: {user_name}")
    else:
        user_name = input(f"Enter name to verify against ({'/'.join(profile_names)}): ").strip()
        if user_name not in profile_names:
            print(f"❌ Profile '{user_name}' not found")
            return
    
    print(f"\n👂 Ready to verify if you are '{user_name}'")
    print("📋 Instructions:")
    print("- Speak clearly and naturally")
    print("- Say anything you want")
    print("- I'll check if your voice matches the saved profile")
    
    input("\nPress Enter when ready to speak...")
    
    # Verify voice
    is_match, score, transcript = verifier.verify_voice(user_name)
    
    print(f"\n📝 What you said: '{transcript}'")
    
    if is_match:
        print(f"\n🎉 SUCCESS! Welcome back, {user_name}! 👋")
    else:
        print(f"\n🚫 ACCESS DENIED! You don't sound like {user_name}")
        print("💡 Try speaking more clearly, or you might need to re-record your profile")
    
    # Ask if want to try again
    again = input(f"\nTry again? (y/n): ").lower().strip()
    if again == 'y':
        main()

if __name__ == "__main__":
    main()
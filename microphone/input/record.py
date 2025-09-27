#!/usr/bin/env python3
"""
Simple Voice Recorder
Records your voice and saves it for later verification.
Also shows what you said via speech-to-text.
"""

import os
import json
import numpy as np
import librosa
import speech_recognition as sr
from typing import Dict
import warnings
warnings.filterwarnings("ignore")

class VoiceRecorder:
    def __init__(self, data_file: str = "voice_data.json"):
        self.data_file = data_file
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        print("🎤 Voice Recorder Ready!")
    
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
    
    def record_and_transcribe(self, duration: int = 10):
        """Record voice, extract features, and transcribe speech."""
        try:
            print(f"\n🎤 Recording for {duration} seconds...")
            print("💬 Speak clearly - I'll show you what you said!")
            
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
            
            return features, text, audio_data
            
        except sr.WaitTimeoutError:
            print("❌ No speech detected - try speaking louder or closer to microphone")
            return None, None, None
        except Exception as e:
            print(f"❌ Recording error: {e}")
            return None, None, None
    
    def save_voice_profile(self, user_name: str, num_samples: int = 3):
        """Record multiple voice samples and save profile."""
        print(f"\n👤 Recording voice profile for: {user_name}")
        print(f"📊 We'll record {num_samples} samples for better accuracy")
        
        all_features = []
        all_transcripts = []
        
        for i in range(num_samples):
            print(f"\n--- Sample {i+1}/{num_samples} ---")
            input("Press Enter when ready to record...")
            
            features, text, audio_data = self.record_and_transcribe(duration=10)
            
            if features is not None:
                all_features.append(features)
                all_transcripts.append(text)
                print(f"✅ Sample {i+1} recorded successfully")
            else:
                print(f"❌ Failed to record sample {i+1} - trying again...")
                i -= 1  # Retry this sample
        
        if len(all_features) == 0:
            print("❌ No valid samples recorded!")
            return False
        
        # Calculate average features
        print("\n🧮 Calculating voice profile...")
        avg_features = {}
        for key in all_features[0].keys():
            if isinstance(all_features[0][key], list):
                avg_features[key] = np.mean([f[key] for f in all_features], axis=0).tolist()
            else:
                avg_features[key] = np.mean([f[key] for f in all_features])
        
        # Load existing data
        voice_data = {}
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, 'r') as f:
                    voice_data = json.load(f)
            except:
                pass
        
        # Save profile
        voice_data[user_name] = {
            'features': avg_features,
            'samples_count': len(all_features),
            'transcripts': all_transcripts
        }
        
        with open(self.data_file, 'w') as f:
            json.dump(voice_data, f, indent=2)
        
        print(f"\n🎉 Voice profile saved for '{user_name}'!")
        print(f"📊 Processed {len(all_features)}/{num_samples} samples")
        print(f"💾 Data saved to: {self.data_file}")
        
        print("\n📝 What you said during recording:")
        for i, transcript in enumerate(all_transcripts):
            print(f"   Sample {i+1}: {transcript}")
        
        return True

def main():
    """Main function to record voice profile."""
    print("🎤 VOICE RECORDER")
    print("=" * 40)
    
    recorder = VoiceRecorder()
    
    user_name = input("Enter your name: ").strip()
    if not user_name:
        user_name = "default_user"
    
    print(f"\n👋 Hi {user_name}!")
    print("📋 Instructions:")
    print("- Speak clearly and naturally")
    print("- Record in a quiet environment")  
    print("- Say different things for each sample")
    print("- I'll show you what you said!")
    
    success = recorder.save_voice_profile(user_name, num_samples=3)
    
    if success:
        print(f"\n✅ SUCCESS! Voice profile created for '{user_name}'")
        print("🔍 Now you can run 'verify.py' to test voice verification!")
    else:
        print("\n❌ Failed to create voice profile")

if __name__ == "__main__":
    main()
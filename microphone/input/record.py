#!/usr/bin/env python3
"""
Robust Voice Recorder with Advanced Audio Processing
Records high-quality voice profiles with multiple validation steps.
"""

import os
import json
import numpy as np
import librosa
import speech_recognition as sr
from typing import Dict, List, Tuple, Optional
import warnings
from scipy import stats
from scipy.signal import butter, filtfilt
import hashlib
warnings.filterwarnings("ignore")

class RobustVoiceRecorder:
    def __init__(self, data_file: str = "voice_profiles.json", target_sr: int = 16000):
        self.data_file = data_file
        self.target_sr = target_sr
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        
        # Enhanced parameters
        self.min_speech_duration = 2.0  # Minimum seconds of actual speech
        self.max_silence_ratio = 1.0    # Maximum allowed silence in recording
        self.min_snr_db = 5           # Minimum signal-to-noise ratio
        
        # Configure recognizer for better performance
        self.recognizer.energy_threshold = 300
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 0.8
        
        print("🎤 Robust Voice Recorder Ready!")
        print("🔧 Enhanced with: Voice Activity Detection, SNR Analysis, Multi-sample Validation")

    def _preprocess_audio(self, audio_data: np.ndarray, sr: int) -> np.ndarray:
        """Advanced audio preprocessing pipeline."""
        try:
            # Resample to target sample rate
            if sr != self.target_sr:
                audio_data = librosa.resample(audio_data, orig_sr=sr, target_sr=self.target_sr)
            
            # Ensure mono
            if audio_data.ndim > 1:
                audio_data = np.mean(audio_data, axis=1)
            
            # Normalize to [-1, 1] range
            if np.max(np.abs(audio_data)) > 0:
                audio_data = audio_data / np.max(np.abs(audio_data))
            
            # Apply bandpass filter for speech frequencies (80Hz - 8000Hz)
            nyquist = self.target_sr / 2
            low_freq = 80 / nyquist
            high_freq = min(8000 / nyquist, 0.95)  # Avoid aliasing
            
            if low_freq < high_freq:
                b, a = butter(4, [low_freq, high_freq], btype='band')
                audio_data = filtfilt(b, a, audio_data)
            
            # Remove DC offset
            audio_data = audio_data - np.mean(audio_data)
            
            return audio_data.astype(np.float32)
            
        except Exception as e:
            print(f"❌ Preprocessing error: {e}")
            return audio_data.astype(np.float32)

    def _detect_voice_activity(self, audio_data: np.ndarray) -> Tuple[bool, float, float]:
        """Detect voice activity and calculate quality metrics."""
        try:
            # Calculate energy-based voice activity
            frame_length = int(0.025 * self.target_sr)  # 25ms frames
            hop_length = int(0.010 * self.target_sr)    # 10ms hop
            
            # RMS energy per frame
            rms = librosa.feature.rms(y=audio_data, frame_length=frame_length, hop_length=hop_length)[0]
            
            # Dynamic threshold based on audio statistics
            rms_threshold = np.percentile(rms, 70)  # 70th percentile as threshold
            voice_frames = rms > rms_threshold
            
            # Calculate speech ratio
            speech_ratio = np.mean(voice_frames)
            
            # Estimate SNR
            if np.sum(voice_frames) > 0:
                signal_power = np.mean(rms[voice_frames] ** 2)
                noise_power = np.mean(rms[~voice_frames] ** 2) + 1e-10
                snr_db = 10 * np.log10(signal_power / noise_power)
            else:
                snr_db = 0
            
            # Quality checks
            has_speech = speech_ratio >= (1 - self.max_silence_ratio)
            good_snr = snr_db >= self.min_snr_db
            sufficient_duration = len(audio_data) / self.target_sr >= self.min_speech_duration
            
            is_good_quality = has_speech and good_snr and sufficient_duration
            
            return is_good_quality, speech_ratio, snr_db
            
        except Exception as e:
            print(f"❌ Voice activity detection error: {e}")
            return False, 0.0, 0.0

    def _extract_robust_features(self, audio_data: np.ndarray) -> Optional[Dict]:
        """Extract robust voice features with multiple descriptors."""
        try:
            if len(audio_data) < 1024:  # Too short
                return None
            
            # Fundamental frequency (F0) tracking
            f0, voiced_flag, voiced_probs = librosa.pyin(
                audio_data, fmin=80, fmax=400, sr=self.target_sr, frame_length=2048
            )
            f0_mean = np.nanmean(f0[voiced_flag]) if np.any(voiced_flag) else 0.0
            f0_std = np.nanstd(f0[voiced_flag]) if np.any(voiced_flag) else 0.0
            
            # MFCC features (robust to noise)
            mfcc = librosa.feature.mfcc(
                y=audio_data, sr=self.target_sr, n_mfcc=13, 
                n_fft=2048, hop_length=512, n_mels=40
            )
            mfcc_mean = np.mean(mfcc, axis=1)
            mfcc_std = np.std(mfcc, axis=1)
            mfcc_delta = np.mean(librosa.feature.delta(mfcc), axis=1)
            
            # Spectral features
            spectral_centroids = librosa.feature.spectral_centroid(y=audio_data, sr=self.target_sr)[0]
            spectral_rolloff = librosa.feature.spectral_rolloff(y=audio_data, sr=self.target_sr)[0]
            spectral_bandwidth = librosa.feature.spectral_bandwidth(y=audio_data, sr=self.target_sr)[0]
            
            # Chroma and tonnetz (pitch class profiles)
            chroma = librosa.feature.chroma_stft(y=audio_data, sr=self.target_sr)
            tonnetz = librosa.feature.tonnetz(y=audio_data, sr=self.target_sr)
            
            # Temporal features
            zcr = librosa.feature.zero_crossing_rate(audio_data)[0]
            rms_energy = librosa.feature.rms(y=audio_data)[0]
            
            # Prosodic features (rhythm and stress patterns)
            tempo, beats = librosa.beat.beat_track(y=audio_data, sr=self.target_sr)
            
            return {
                # Fundamental frequency features
                'f0_mean': float(f0_mean),
                'f0_std': float(f0_std),
                'voicing_ratio': float(np.mean(voiced_flag)),
                
                # MFCC features (most important for speaker recognition)
                'mfcc_mean': mfcc_mean.tolist(),
                'mfcc_std': mfcc_std.tolist(),
                'mfcc_delta': mfcc_delta.tolist(),
                
                # Spectral features
                'spectral_centroid_mean': float(np.mean(spectral_centroids)),
                'spectral_centroid_std': float(np.std(spectral_centroids)),
                'spectral_rolloff_mean': float(np.mean(spectral_rolloff)),
                'spectral_bandwidth_mean': float(np.mean(spectral_bandwidth)),
                
                # Harmonic features
                'chroma_mean': np.mean(chroma, axis=1).tolist(),
                'tonnetz_mean': np.mean(tonnetz, axis=1).tolist(),
                
                # Temporal features
                'zcr_mean': float(np.mean(zcr)),
                'zcr_std': float(np.std(zcr)),
                'rms_mean': float(np.mean(rms_energy)),
                'rms_std': float(np.std(rms_energy)),
                'tempo': float(tempo),
                
                # Statistical moments
                'audio_duration': float(len(audio_data) / self.target_sr),
                'audio_rms': float(np.sqrt(np.mean(audio_data**2)))
            }
            
        except Exception as e:
            print(f"❌ Feature extraction error: {e}")
            return None

    def _audio_to_numpy(self, audio: sr.AudioData) -> Tuple[np.ndarray, int]:
        """Convert AudioData to numpy array with proper handling."""
        try:
            raw_data = audio.get_raw_data()
            sample_width = audio.sample_width
            sample_rate = audio.sample_rate
            
            # Convert based on sample width
            if sample_width == 1:
                dtype = np.uint8
                audio_array = np.frombuffer(raw_data, dtype=dtype).astype(np.float32)
                audio_array = (audio_array - 128.0) / 128.0
            elif sample_width == 2:
                dtype = np.int16
                audio_array = np.frombuffer(raw_data, dtype=dtype).astype(np.float32)
                audio_array = audio_array / 32768.0
            elif sample_width == 4:
                dtype = np.int32
                audio_array = np.frombuffer(raw_data, dtype=dtype).astype(np.float32)
                audio_array = audio_array / 2147483648.0
            else:
                # Fallback
                audio_array = np.frombuffer(raw_data, dtype=np.int16).astype(np.float32)
                audio_array = audio_array / 32768.0
            
            return audio_array, sample_rate
            
        except Exception as e:
            print(f"❌ Audio conversion error: {e}")
            return np.array([]), 16000

    def record_sample(self, duration: int = 5) -> Tuple[Optional[Dict], str, bool]:
        """Record a single high-quality voice sample."""
        try:
            print(f"\n🎤 Recording for {duration} seconds...")
            print("💡 Tip: Speak clearly and naturally. Avoid background noise.")
            
            with self.microphone as source:
                print("🔧 Calibrating microphone...")
                self.recognizer.adjust_for_ambient_noise(source, duration=1.0)
                
                print("🔴 Recording now... Start speaking!")
                audio = self.recognizer.record(source, duration=duration)
            
            print("✅ Recording completed!")
            
            # Convert to numpy array
            audio_np, orig_sr = self._audio_to_numpy(audio)
            if len(audio_np) == 0:
                return None, "[Recording failed]", False
            
            # Preprocess audio
            processed_audio = self._preprocess_audio(audio_np, orig_sr)
            
            # Check voice activity and quality
            is_good_quality, speech_ratio, snr_db = self._detect_voice_activity(processed_audio)
            
            print(f"📊 Quality Analysis:")
            print(f"   Speech Ratio: {speech_ratio:.2f} (need >{1-self.max_silence_ratio:.2f})")
            print(f"   SNR: {snr_db:.1f} dB (need >{self.min_snr_db} dB)")
            print(f"   Duration: {len(processed_audio)/self.target_sr:.1f}s")
            
            if not is_good_quality:
                reasons = []
                if speech_ratio < (1 - self.max_silence_ratio):
                    reasons.append("too much silence")
                if snr_db < self.min_snr_db:
                    reasons.append("too noisy")
                if len(processed_audio) / self.target_sr < self.min_speech_duration:
                    reasons.append("too short")
                
                print(f"⚠️  Low quality recording: {', '.join(reasons)}")
                return None, "[Low quality recording]", False
            
            # Extract features
            print("🧠 Extracting voice features...")
            features = self._extract_robust_features(processed_audio)
            
            if features is None:
                return None, "[Feature extraction failed]", False
            
            # Speech recognition
            print("📝 Transcribing speech...")
            try:
                text = self.recognizer.recognize_google(audio, language='en-US')
                print(f"💬 You said: '{text}'")
            except sr.UnknownValueError:
                text = "[Could not understand speech]"
                print("❓ Could not understand speech clearly")
            except sr.RequestError as e:
                text = "[Speech recognition unavailable]"
                print(f"⚠️ Speech recognition error: {e}")
            
            print("✅ High-quality sample recorded!")
            return features, text, True
            
        except Exception as e:
            print(f"❌ Recording error: {e}")
            return None, "[Recording error]", False

    def create_voice_profile(self, user_name: str, num_samples: int = 5) -> bool:
        """Create a robust voice profile with multiple samples and validation."""
        print(f"\n👤 Creating voice profile for: {user_name}")
        print(f"🎯 Target: {num_samples} high-quality samples")
        print("📋 Tips for best results:")
        print("   • Record in a quiet environment")
        print("   • Speak naturally and clearly")
        print("   • Say different phrases for each sample")
        print("   • Keep consistent distance from microphone")
        
        valid_samples = []
        transcripts = []
        attempt = 0
        max_attempts = num_samples * 3  # Allow retries
        
        while len(valid_samples) < num_samples and attempt < max_attempts:
            attempt += 1
            print(f"\n--- Sample {len(valid_samples)+1}/{num_samples} (Attempt {attempt}) ---")
            
            input("Press Enter when ready to record...")
            
            features, text, is_valid = self.record_sample(duration=5)
            
            if is_valid and features is not None:
                valid_samples.append(features)
                transcripts.append(text)
                print(f"✅ Sample {len(valid_samples)} accepted!")
            else:
                print("❌ Sample rejected. Please try again.")
                retry = input("Try this sample again? (y/n): ").lower().strip()
                if retry != 'y':
                    print("⏭️ Skipping to next sample...")
        
        if len(valid_samples) < 2:
            print(f"❌ Failed to record enough samples ({len(valid_samples)}/{num_samples})")
            return False
        
        print(f"\n🧮 Processing {len(valid_samples)} valid samples...")
        
        # Calculate robust statistics across samples
        profile_features = self._calculate_profile_statistics(valid_samples)
        
        # Generate profile fingerprint for integrity
        profile_hash = self._generate_profile_hash(profile_features, user_name)
        
        # Load existing profiles
        profiles = self._load_profiles()
        
        # Save profile
        profiles[user_name] = {
            'features': profile_features,
            'sample_count': len(valid_samples),
            'transcripts': transcripts,
            'created_timestamp': np.datetime64('now').astype(str),
            'profile_hash': profile_hash,
            'version': '2.0'  # Version for compatibility
        }
        
        success = self._save_profiles(profiles)
        
        if success:
            print(f"\n🎉 Voice profile created successfully!")
            print(f"👤 User: {user_name}")
            print(f"📊 Samples: {len(valid_samples)}/{num_samples}")
            print(f"💾 Saved to: {self.data_file}")
            print(f"🔒 Profile hash: {profile_hash[:12]}...")
            
            print("\n📝 Recorded phrases:")
            for i, transcript in enumerate(transcripts, 1):
                print(f"   {i}. {transcript}")
            
            return True
        else:
            print("❌ Failed to save profile!")
            return False

    def _calculate_profile_statistics(self, samples: List[Dict]) -> Dict:
        """Calculate robust statistics across multiple samples."""
        profile = {}
        
        # Get all feature keys from first sample
        feature_keys = samples[0].keys()
        
        for key in feature_keys:
            values = [sample[key] for sample in samples]
            
            if isinstance(values[0], list):
                # Handle list features (e.g., MFCC coefficients)
                values_array = np.array(values)
                profile[f'{key}'] = np.mean(values_array, axis=0).tolist()
                profile[f'{key}_std'] = np.std(values_array, axis=0).tolist()
                profile[f'{key}_median'] = np.median(values_array, axis=0).tolist()
            else:
                # Handle scalar features
                profile[f'{key}'] = float(np.mean(values))
                profile[f'{key}_std'] = float(np.std(values))
                profile[f'{key}_median'] = float(np.median(values))
                # Add robust statistics
                profile[f'{key}_q25'] = float(np.percentile(values, 25))
                profile[f'{key}_q75'] = float(np.percentile(values, 75))
        
        return profile

    def _generate_profile_hash(self, features: Dict, user_name: str) -> str:
        """Generate a hash for profile integrity checking."""
        # Create a string representation of key features
        key_features = {
            'user': user_name,
            'mfcc': features.get('mfcc_mean', []),
            'f0': features.get('f0_mean', 0),
            'spectral': features.get('spectral_centroid_mean', 0)
        }
        
        feature_str = json.dumps(key_features, sort_keys=True)
        return hashlib.sha256(feature_str.encode()).hexdigest()

    def _load_profiles(self) -> Dict:
        """Load existing voice profiles."""
        if not os.path.exists(self.data_file):
            return {}
        
        try:
            with open(self.data_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Error loading profiles: {e}")
            return {}

    def _save_profiles(self, profiles: Dict) -> bool:
        """Save voice profiles to file."""
        try:
            # Create backup if file exists
            if os.path.exists(self.data_file):
                backup_file = f"{self.data_file}.backup"
                os.rename(self.data_file, backup_file)
            
            with open(self.data_file, 'w') as f:
                json.dump(profiles, f, indent=2)
            
            return True
        except Exception as e:
            print(f"❌ Error saving profiles: {e}")
            return False

def main():
    """Main function for interactive voice profile creation."""
    print("🎤 ROBUST VOICE RECORDER")
    print("=" * 50)
    
    recorder = RobustVoiceRecorder()
    
    # Get user name
    user_name = input("Enter your name: ").strip()
    if not user_name:
        user_name = "default_user"
    
    print(f"\n👋 Hello {user_name}!")
    
    # Check if profile exists
    profiles = recorder._load_profiles()
    if user_name in profiles:
        overwrite = input(f"Profile for '{user_name}' already exists. Overwrite? (y/n): ").lower()
        if overwrite != 'y':
            print("❌ Operation cancelled.")
            return
    
    # Get number of samples
    try:
        num_samples = int(input("Number of samples to record (3-10, recommended 5): ") or "5")
        num_samples = max(3, min(10, num_samples))
    except ValueError:
        num_samples = 5
    
    print(f"\n🎯 Recording {num_samples} samples for optimal accuracy...")
    
    # Create profile
    success = recorder.create_voice_profile(user_name, num_samples)
    
    if success:
        print(f"\n✅ SUCCESS! Robust voice profile created for '{user_name}'")
        print("🔍 You can now use the voice verifier for secure authentication!")
    else:
        print("\n❌ Failed to create voice profile. Please try again.")

if __name__ == "__main__":
    main()
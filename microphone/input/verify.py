#!/usr/bin/env python3
"""
Robust Voice Verifier with Advanced Matching Algorithms
Uses multiple similarity metrics and adaptive thresholds for reliable verification.
"""

import os
import json
import numpy as np
import librosa
import speech_recognition as sr
from typing import Dict, Tuple, Optional, List
import warnings
from scipy import stats
from scipy.signal import butter, filtfilt
from scipy.spatial.distance import cosine, euclidean
from sklearn.preprocessing import StandardScaler
import hashlib
warnings.filterwarnings("ignore")

class RobustVoiceVerifier:
    def __init__(self, data_file: str = "voice_profiles.json", target_sr: int = 16000):
        self.data_file = data_file
        self.target_sr = target_sr
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        
        # Enhanced verification parameters
        self.base_threshold = 0.25  # Lower is more strict
        self.confidence_levels = {
            'high': 0.15,      # Very confident match
            'medium': 0.25,    # Good match  
            'low': 0.40,       # Acceptable match
            'reject': 0.55     # Reject above this
        }
        
        # Quality requirements for verification
        self.min_snr_db = 2
        self.min_speech_ratio = 0.1
        self.min_duration = 1.0
        
        # Configure recognizer
        self.recognizer.energy_threshold = 300
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.pause_threshold = 0.8
        
        print("🔍 Robust Voice Verifier Ready!")
        print("🛡️ Enhanced with: Multi-metric Matching, Adaptive Thresholds, Quality Control")

    def _preprocess_audio(self, audio_data: np.ndarray, sr: int) -> np.ndarray:
        """Identical preprocessing as recorder for consistency."""
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
            high_freq = min(8000 / nyquist, 0.95)
            
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
            frame_length = int(0.025 * self.target_sr)
            hop_length = int(0.010 * self.target_sr)
            
            rms = librosa.feature.rms(y=audio_data, frame_length=frame_length, hop_length=hop_length)[0]
            rms_threshold = np.percentile(rms, 70)
            voice_frames = rms > rms_threshold
            speech_ratio = np.mean(voice_frames)
            
            if np.sum(voice_frames) > 0:
                signal_power = np.mean(rms[voice_frames] ** 2)
                noise_power = np.mean(rms[~voice_frames] ** 2) + 1e-10
                snr_db = 10 * np.log10(signal_power / noise_power)
            else:
                snr_db = 0
            
            is_good_quality = (speech_ratio >= self.min_speech_ratio and 
                             snr_db >= self.min_snr_db and 
                             len(audio_data) / self.target_sr >= self.min_duration)
            
            return is_good_quality, speech_ratio, snr_db
            
        except Exception as e:
            print(f"❌ Voice activity detection error: {e}")
            return False, 0.0, 0.0

    def _extract_robust_features(self, audio_data: np.ndarray) -> Optional[Dict]:
        """Extract robust voice features identical to recorder."""
        try:
            if len(audio_data) < 1024:
                return None
            
            # Fundamental frequency (F0) tracking
            f0, voiced_flag, voiced_probs = librosa.pyin(
                audio_data, fmin=80, fmax=400, sr=self.target_sr, frame_length=2048
            )
            f0_mean = np.nanmean(f0[voiced_flag]) if np.any(voiced_flag) else 0.0
            f0_std = np.nanstd(f0[voiced_flag]) if np.any(voiced_flag) else 0.0
            
            # MFCC features
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
            
            # Chroma and tonnetz
            chroma = librosa.feature.chroma_stft(y=audio_data, sr=self.target_sr)
            tonnetz = librosa.feature.tonnetz(y=audio_data, sr=self.target_sr)
            
            # Temporal features
            zcr = librosa.feature.zero_crossing_rate(audio_data)[0]
            rms_energy = librosa.feature.rms(y=audio_data)[0]
            
            # Prosodic features
            tempo, beats = librosa.beat.beat_track(y=audio_data, sr=self.target_sr)
            
            return {
                'f0_mean': float(f0_mean),
                'f0_std': float(f0_std),
                'voicing_ratio': float(np.mean(voiced_flag)),
                'mfcc_mean': mfcc_mean.tolist(),
                'mfcc_std': mfcc_std.tolist(),
                'mfcc_delta': mfcc_delta.tolist(),
                'spectral_centroid_mean': float(np.mean(spectral_centroids)),
                'spectral_centroid_std': float(np.std(spectral_centroids)),
                'spectral_rolloff_mean': float(np.mean(spectral_rolloff)),
                'spectral_bandwidth_mean': float(np.mean(spectral_bandwidth)),
                'chroma_mean': np.mean(chroma, axis=1).tolist(),
                'tonnetz_mean': np.mean(tonnetz, axis=1).tolist(),
                'zcr_mean': float(np.mean(zcr)),
                'zcr_std': float(np.std(zcr)),
                'rms_mean': float(np.mean(rms_energy)),
                'rms_std': float(np.std(rms_energy)),
                'tempo': float(tempo),
                'audio_duration': float(len(audio_data) / self.target_sr),
                'audio_rms': float(np.sqrt(np.mean(audio_data**2)))
            }
            
        except Exception as e:
            print(f"❌ Feature extraction error: {e}")
            return None

    def _calculate_multi_metric_similarity(self, current_features: Dict, profile_features: Dict) -> Dict:
        """Calculate similarity using multiple robust metrics."""
        try:
            similarities = {}
            
            # 1. MFCC Similarity (Most important for speaker recognition)
            current_mfcc = np.array(current_features['mfcc_mean'])
            profile_mfcc = np.array(profile_features['mfcc_mean'])
            
            # Cosine similarity (direction)
            mfcc_cosine = 1 - cosine(current_mfcc, profile_mfcc)
            
            # Normalized Euclidean distance
            mfcc_euclidean = euclidean(current_mfcc, profile_mfcc) / (np.linalg.norm(current_mfcc) + np.linalg.norm(profile_mfcc) + 1e-8)
            
            # Combined MFCC score
            similarities['mfcc_score'] = (mfcc_cosine + (1 - mfcc_euclidean)) / 2
            
            # 2. Fundamental Frequency Similarity
            current_f0 = current_features['f0_mean']
            profile_f0 = profile_features['f0_mean']
            profile_f0_std = profile_features.get('f0_mean_std', 20.0)  # Default std
            
            if current_f0 > 0 and profile_f0 > 0:
                f0_diff = abs(current_f0 - profile_f0)
                # Use z-score based similarity (within 3 standard deviations for more leniency)
                f0_z_score = f0_diff / (profile_f0_std + 1e-6)
                similarities['f0_score'] = max(0, 1 - f0_z_score / 3)
            else:
                similarities['f0_score'] = 0.5  # Neutral if F0 not available
            
            # 3. Spectral Similarity
            spectral_features = ['spectral_centroid_mean', 'spectral_rolloff_mean', 'spectral_bandwidth_mean']
            spectral_scores = []
            
            for feature in spectral_features:
                current_val = current_features.get(feature, 0)
                profile_val = profile_features.get(feature, 0)
                profile_std = profile_features.get(f'{feature}_std', abs(profile_val) * 0.2 + 1)
                
                if profile_val != 0:
                    relative_diff = abs(current_val - profile_val) / (abs(profile_val) + 1e-6)
                    z_score = relative_diff / (profile_std / abs(profile_val) + 1e-6)
                    score = max(0, 1 - z_score / 3)
                    spectral_scores.append(score)
            
            similarities['spectral_score'] = np.mean(spectral_scores) if spectral_scores else 0.5
            
            # 4. Chroma Similarity (Harmonic content)
            if 'chroma_mean' in current_features and 'chroma_mean' in profile_features:
                current_chroma = np.array(current_features['chroma_mean'])
                profile_chroma = np.array(profile_features['chroma_mean'])
                similarities['chroma_score'] = 1 - cosine(current_chroma, profile_chroma)
            else:
                similarities['chroma_score'] = 0.5
            
            # 5. Temporal Pattern Similarity
            temporal_features = ['zcr_mean', 'rms_mean', 'tempo']
            temporal_scores = []
            
            for feature in temporal_features:
                current_val = current_features.get(feature, 0)
                profile_val = profile_features.get(feature, 0)
                profile_std = profile_features.get(f'{feature}_std', abs(profile_val) * 0.3 + 1)
                
                if profile_val != 0:
                    relative_diff = abs(current_val - profile_val) / (abs(profile_val) + 1e-6)
                    z_score = relative_diff / (profile_std / abs(profile_val) + 1e-6)
                    score = max(0, 1 - z_score / 2)
                    temporal_scores.append(score)
            
            similarities['temporal_score'] = np.mean(temporal_scores) if temporal_scores else 0.5
            
            # 6. Voice Activity Similarity
            current_voicing = current_features.get('voicing_ratio', 0)
            profile_voicing = profile_features.get('voicing_ratio', 0)
            voicing_diff = abs(current_voicing - profile_voicing)
            similarities['voicing_score'] = max(0, 1 - voicing_diff * 2)  # Scale difference
            
            return similarities
            
        except Exception as e:
            print(f"❌ Similarity calculation error: {e}")
            return {'mfcc_score': 0, 'f0_score': 0, 'spectral_score': 0, 
                   'chroma_score': 0, 'temporal_score': 0, 'voicing_score': 0}

    def _calculate_composite_score(self, similarities: Dict) -> float:
        """Calculate weighted composite similarity score."""
        # Weights based on importance for speaker recognition
        weights = {
            'mfcc_score': 0.40,      # Most important - voice timbre
            'f0_score': 0.20,        # Pitch characteristics
            'spectral_score': 0.15,  # Spectral shape
            'temporal_score': 0.15,  # Speaking patterns
            'chroma_score': 0.05,    # Harmonic content
            'voicing_score': 0.05    # Voice activity patterns
        }
        
        weighted_sum = sum(similarities.get(metric, 0) * weight 
                          for metric, weight in weights.items())
        
        return weighted_sum

    def _adaptive_threshold(self, profile_data: Dict, composite_score: float, similarities: Dict) -> Tuple[str, float]:
        """Determine adaptive threshold based on profile quality and consistency."""
        
        # Base threshold adjustment factors
        threshold_adjustment = 0.0
        
        # 1. Adjust based on profile sample count
        sample_count = profile_data.get('sample_count', 1)
        if sample_count >= 5:
            threshold_adjustment -= 0.05  # More lenient with more samples
        elif sample_count < 3:
            threshold_adjustment += 0.01  # Less strict with fewer samples
        
        # 2. Adjust based on key metric confidence
        mfcc_score = similarities.get('mfcc_score', 0)
        f0_score = similarities.get('f0_score', 0)
        
        # If key metrics are very strong, be more confident
        if mfcc_score > 0.6 and f0_score > 0.5:
            threshold_adjustment -= 0.05
        elif mfcc_score < 0.2 or f0_score < 0.1:
            threshold_adjustment += 0.01
        
        # 3. Calculate adaptive thresholds
        adaptive_thresholds = {
            'high': self.confidence_levels['high'] + threshold_adjustment,
            'medium': self.confidence_levels['medium'] + threshold_adjustment,
            'low': self.confidence_levels['low'] + threshold_adjustment,
            'reject': self.confidence_levels['reject'] + threshold_adjustment
        }
        
        # Determine confidence level
        distance = 1 - composite_score  # Convert similarity to distance
        
        if distance <= adaptive_thresholds['high']:
            return 'high', distance
        elif distance <= adaptive_thresholds['medium']:
            return 'medium', distance
        elif distance <= adaptive_thresholds['low']:
            return 'low', distance
        else:
            return 'reject', distance

    def _audio_to_numpy(self, audio: sr.AudioData) -> Tuple[np.ndarray, int]:
        """Convert AudioData to numpy array."""
        try:
            raw_data = audio.get_raw_data()
            sample_width = audio.sample_width
            sample_rate = audio.sample_rate
            
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
                audio_array = np.frombuffer(raw_data, dtype=np.int16).astype(np.float32)
                audio_array = audio_array / 32768.0
            
            return audio_array, sample_rate
            
        except Exception as e:
            print(f"❌ Audio conversion error: {e}")
            return np.array([]), 16000

    def record_verification_sample(self, duration: int = 4) -> Tuple[Optional[Dict], str, Dict]:
        """Record and analyze a verification sample."""
        try:
            print(f"\n🎤 Recording verification sample ({duration} seconds)...")
            print("💡 Speak naturally as you did during enrollment")
            
            with self.microphone as source:
                print("🔧 Calibrating...")
                self.recognizer.adjust_for_ambient_noise(source, duration=0.8)
                
                print("🔴 Recording... Speak now!")
                audio = self.recognizer.record(source, duration=duration)
            
            print("✅ Recording completed!")
            
            # Convert and preprocess
            audio_np, orig_sr = self._audio_to_numpy(audio)
            if len(audio_np) == 0:
                return None, "[Recording failed]", {}
            
            processed_audio = self._preprocess_audio(audio_np, orig_sr)
            
            # Quality analysis
            is_good_quality, speech_ratio, snr_db = self._detect_voice_activity(processed_audio)
            
            quality_info = {
                'speech_ratio': speech_ratio,
                'snr_db': snr_db,
                'duration': len(processed_audio) / self.target_sr,
                'is_good_quality': is_good_quality
            }
            
            print(f"📊 Quality: Speech={speech_ratio:.2f}, SNR={snr_db:.1f}dB, Duration={quality_info['duration']:.1f}s")
            
            if not is_good_quality:
                reasons = []
                if speech_ratio < self.min_speech_ratio:
                    reasons.append(f"low speech ratio ({speech_ratio:.2f})")
                if snr_db < self.min_snr_db:
                    reasons.append(f"low SNR ({snr_db:.1f}dB)")
                if quality_info['duration'] < self.min_duration:
                    reasons.append("too short")
                
                print(f"⚠️ Quality issues: {', '.join(reasons)}")
                # Continue anyway but flag it
            
            # Extract features
            features = self._extract_robust_features(processed_audio)
            if features is None:
                return None, "[Feature extraction failed]", quality_info
            
            # Transcription
            try:
                text = self.recognizer.recognize_google(audio, language='en-US')
                print(f"💬 You said: '{text}'")
            except sr.UnknownValueError:
                text = "[Could not understand speech]"
                print("❓ Speech not clearly understood")
            except sr.RequestError as e:
                text = "[Speech recognition unavailable]"
                print(f"⚠️ Recognition error: {e}")
            
            return features, text, quality_info
            
        except Exception as e:
            print(f"❌ Recording error: {e}")
            return None, "[Recording error]", {}

    def verify_speaker(self, target_user: str) -> Dict:
        """Perform comprehensive speaker verification."""
        
        # Load profiles
        if not os.path.exists(self.data_file):
            return {
                'verified': False,
                'confidence': 'none',
                'error': 'No profiles found',
                'similarity_score': 0.0
            }
        
        try:
            with open(self.data_file, 'r') as f:
                profiles = json.load(f)
        except Exception as e:
            return {
                'verified': False,
                'confidence': 'none', 
                'error': f'Error loading profiles: {e}',
                'similarity_score': 0.0
            }
        
        if target_user not in profiles:
            available = list(profiles.keys())
            return {
                'verified': False,
                'confidence': 'none',
                'error': f'Profile not found. Available: {available}',
                'similarity_score': 0.0
            }
        
        profile_data = profiles[target_user]
        
        print(f"\n🎯 Verifying against: {target_user}")
        print(f"📊 Profile info: {profile_data.get('sample_count', 'unknown')} samples")
        
        input("Press Enter when ready to speak for verification...")
        
        # Record verification sample
        current_features, transcript, quality_info = self.record_verification_sample()
        
        if current_features is None:
            return {
                'verified': False,
                'confidence': 'none',
                'error': 'Failed to record verification sample',
                'similarity_score': 0.0,
                'transcript': transcript,
                'quality': quality_info
            }
        
        # Calculate similarities
        print("🧠 Analyzing voice patterns...")
        similarities = self._calculate_multi_metric_similarity(current_features, profile_data['features'])
        
        # Calculate composite score
        composite_score = self._calculate_composite_score(similarities)
        
        # Simple verification logic: if similarity > 0.5 then voice is matched
        is_verified = composite_score > 0.5
        
        # Set confidence level based on similarity score
        if composite_score > 0.8:
            confidence_level = 'high'
        elif composite_score > 0.65:
            confidence_level = 'medium'
        elif composite_score > 0.5:
            confidence_level = 'low'
        else:
            confidence_level = 'reject'
        
        distance = 1 - composite_score  # Convert similarity to distance
        
        # Detailed results
        result = {
            'verified': is_verified,
            'confidence': confidence_level,
            'similarity_score': composite_score,
            'distance': distance,
            'transcript': transcript,
            'quality': quality_info,
            'detailed_scores': similarities,
            'target_user': target_user
        }
        
        # Print detailed analysis
        print(f"\n🔍 VERIFICATION ANALYSIS")
        print(f"=" * 40)
        print(f"👤 Target User: {target_user}")
        print(f"📝 You said: '{transcript}'")
        print(f"📊 Overall Similarity: {composite_score:.3f}")
        print(f"📏 Distance Score: {distance:.3f}")
        print(f"🎯 Confidence Level: {confidence_level.upper()}")
        
        print(f"\n📋 Detailed Scores:")
        for metric, score in similarities.items():
            print(f"   {metric.replace('_', ' ').title()}: {score:.3f}")
        
        if not quality_info.get('is_good_quality', False):
            print(f"\n⚠️  Audio quality concerns detected")
        
        if is_verified:
            confidence_emoji = {'high': '🟢', 'medium': '🟡', 'low': '🟠'}
            print(f"\n✅ VERIFIED {confidence_emoji.get(confidence_level, '🟢')}")
            print(f"🎉 Welcome back, {target_user}!")
        else:
            print(f"\n❌ NOT VERIFIED 🔴")
            print(f"🚫 Access denied - voice does not match {target_user}")
        
        return result

    def list_profiles(self):
        """List all available voice profiles."""
        if not os.path.exists(self.data_file):
            print("❌ No profiles found!")
            return []
        
        try:
            with open(self.data_file, 'r') as f:
                profiles = json.load(f)
            
            if not profiles:
                print("❌ No profiles found!")
                return []
            
            print(f"\n📋 Available Voice Profiles ({len(profiles)}):")
            print("=" * 40)
            
            profile_list = []
            for name, data in profiles.items():
                samples = data.get('sample_count', 'unknown')
                created = data.get('created_timestamp', 'unknown')[:10] if data.get('created_timestamp') else 'unknown'
                version = data.get('version', '1.0')
                
                print(f"👤 {name}")
                print(f"   📊 Samples: {samples}")
                print(f"   📅 Created: {created}")
                print(f"   🔧 Version: {version}")
                print()
                
                profile_list.append(name)
            
            return profile_list
            
        except Exception as e:
            print(f"❌ Error reading profiles: {e}")
            return []

def main():
    """Interactive voice verification."""
    print("🔍 ROBUST VOICE VERIFIER")
    print("=" * 50)
    
    verifier = RobustVoiceVerifier()
    
    # List available profiles
    profiles = verifier.list_profiles()
    if not profiles:
        print("❌ No voice profiles found!")
        print("🎤 Please run the voice recorder first to create profiles.")
        return
    
    # Get target user
    if len(profiles) == 1:
        target_user = profiles[0]
        print(f"🎯 Single profile found: {target_user}")
    else:
        print(f"🎯 Available profiles: {', '.join(profiles)}")
        target_user = input("Enter username to verify: ").strip()
        
        if target_user not in profiles:
            print(f"❌ Profile '{target_user}' not found!")
            return
    
    # Perform verification
    result = verifier.verify_speaker(target_user)
    
    # Summary
    print(f"\n{'='*50}")
    if result['verified']:
        print("🎉 VERIFICATION SUCCESSFUL!")
        print(f"✅ Confirmed identity: {target_user}")
        print(f"🎯 Confidence: {result['confidence'].upper()}")
    else:
        print("🚫 VERIFICATION FAILED!")
        print("❌ Identity could not be confirmed")
        if 'error' in result:
            print(f"⚠️  Error: {result['error']}")
    
    # Ask to try again
    if input(f"\nTry another verification? (y/n): ").lower().strip() == 'y':
        main()

if __name__ == "__main__":
    main()
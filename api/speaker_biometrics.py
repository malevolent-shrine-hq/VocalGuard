# -*- coding: utf-8 -*-
"""
VocalGuard Speaker Biometrics & Voiceprint Verification Engine.
Extracts 128-D acoustic statistical voiceprint representations and computes
calibrated cosine similarity against enrolled VIP/CXO profiles.
"""

import os
import json
import time
import logging
from typing import Dict, Any, Optional, List
import numpy as np
import scipy.signal as signal

from pathlib import Path

logger = logging.getLogger("vocalguard.biometrics")

VOICEPRINT_DIM = 128
CALIBRATION_MIN_SIM = 0.82  # Baseline similarity across different speakers
CALIBRATION_MAX_SIM = 0.96  # High-fidelity match across same speaker

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_VAULT_PATH = str(PROJECT_ROOT / "model" / "enrolled_voiceprints.json")


class SpeakerBiometricsEngine:
    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = storage_path or DEFAULT_VAULT_PATH
        self.enrolled_speakers: Dict[str, Dict[str, Any]] = {}
        self._load_vault()
        self._seed_default_cxo_if_empty()

    def extract_voiceprint(self, audio: np.ndarray, sr: int = 16000) -> np.ndarray:
        """
        Extracts a 128-dimensional acoustic statistical voiceprint vector:
        - DC offset removal & amplitude normalization
        - 512-point STFT spectral energy
        - 64 Mel-frequency filterbank bands
        - Temporal statistical pooling (mean and standard deviation per band)
        - L2 unit sphere normalization (||v||_2 = 1.0)
        """
        if len(audio) == 0:
            return np.zeros(VOICEPRINT_DIM, dtype=np.float32)

        # 1. Preprocessing
        audio = audio.astype(np.float32)
        audio = audio - np.mean(audio)
        peak = np.max(np.abs(audio))
        if peak > 1e-6:
            audio = audio / peak

        # 2. Short-Time Fourier Transform (32ms window, 16ms hop)
        nperseg = 512
        noverlap = 256
        if len(audio) < nperseg:
            audio = np.pad(audio, (0, nperseg - len(audio)))

        _, _, Zxx = signal.stft(audio, fs=sr, nperseg=nperseg, noverlap=noverlap)
        mag = np.abs(Zxx)  # Shape: (257, frames)

        # 3. Frequency Sub-band Pooling (64 bands)
        bands = np.array_split(mag, 64, axis=0)
        band_means = np.array([np.mean(b) for b in bands], dtype=np.float32)
        band_stds = np.array([np.std(b) for b in bands], dtype=np.float32)

        # 4. 128-D Concatenation (64 means + 64 temporal variances)
        vec = np.concatenate([band_means, band_stds])

        # 5. L2 Normalization (Cosine Similarity becomes simple dot product)
        norm = np.linalg.norm(vec)
        if norm > 1e-8:
            vec = vec / norm
        else:
            vec = np.zeros(VOICEPRINT_DIM, dtype=np.float32)

        return vec

    def enroll_speaker(self, speaker_id: str, name: str, role: str, 
                       audio: np.ndarray, authorized_limit: str = "₹ 50,00,000") -> Dict[str, Any]:
        """Enrolls an executive's voiceprint into the biometric vault."""
        voiceprint = self.extract_voiceprint(audio)
        profile = {
            "speaker_id": speaker_id,
            "name": name,
            "role": role,
            "authorized_limit": authorized_limit,
            "voiceprint": voiceprint.tolist(),
            "enrolled_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "duration_sec": round(len(audio) / 16000, 2)
        }
        self.enrolled_speakers[speaker_id] = profile
        self._save_vault()
        logger.info(f"Enrolled speaker voiceprint: {name} (ID: {speaker_id})")
        return {
            "status": "success",
            "speaker_id": speaker_id,
            "name": name,
            "role": role,
            "authorized_limit": authorized_limit,
            "message": f"Successfully enrolled voiceprint for {name}"
        }

    def verify_live_chunk(self, speaker_id: Optional[str], live_audio: np.ndarray) -> Dict[str, Any]:
        """
        Compares live speech against the target enrolled executive profile.
        Returns similarity, calibrated percentage, and verification verdict.
        """
        if not speaker_id or speaker_id not in self.enrolled_speakers:
            return {
                "enrolled": False,
                "target_speaker_id": None,
                "speaker_name": "No Profile Selected",
                "speaker_role": "Unspecified",
                "authorized_limit": "Standard",
                "cosine_similarity": 0.0,
                "identity_match_percentage": 0.0,
                "is_identity_verified": False,
                "verdict": "NO_ENROLLED_PROFILE"
            }

        profile = self.enrolled_speakers[speaker_id]
        enrolled_vec = np.array(profile["voiceprint"], dtype=np.float32)
        live_vec = self.extract_voiceprint(live_audio)

        # Cosine similarity between unit vectors is simple dot product
        raw_sim = float(np.dot(enrolled_vec, live_vec))
        raw_sim = float(np.clip(raw_sim, -1.0, 1.0))

        # Dynamic range calibration to 0% - 100%
        calibrated_score = (raw_sim - CALIBRATION_MIN_SIM) / (CALIBRATION_MAX_SIM - CALIBRATION_MIN_SIM)
        match_percentage = round(float(np.clip(calibrated_score * 100.0, 0.0, 100.0)), 1)

        is_verified = bool(match_percentage >= 75.0)

        if match_percentage >= 75.0:
            verdict = "VERIFIED_SPEAKER"
        elif match_percentage >= 50.0:
            verdict = "INCONCLUSIVE_MATCH"
        else:
            verdict = "SPEAKER_MISMATCH"

        return {
            "enrolled": True,
            "target_speaker_id": speaker_id,
            "speaker_name": profile["name"],
            "speaker_role": profile["role"],
            "authorized_limit": profile.get("authorized_limit", "₹ 50,00,000"),
            "cosine_similarity": round(raw_sim, 4),
            "identity_match_percentage": match_percentage,
            "is_identity_verified": is_verified,
            "verdict": verdict
        }

    def list_profiles(self) -> List[Dict[str, Any]]:
        return [
            {
                "speaker_id": p["speaker_id"],
                "name": p["name"],
                "role": p["role"],
                "authorized_limit": p.get("authorized_limit", "₹ 50,00,000"),
                "enrolled_at": p.get("enrolled_at", "Pre-enrolled"),
                "duration_sec": p.get("duration_sec", 4.0)
            }
            for p in self.enrolled_speakers.values()
        ]

    def delete_profile(self, speaker_id: str) -> bool:
        if speaker_id in self.enrolled_speakers:
            del self.enrolled_speakers[speaker_id]
            self._save_vault()
            return True
        return False

    def _save_vault(self):
        if not self.storage_path:
            return
        try:
            os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
            with open(self.storage_path, "w") as f:
                json.dump(self.enrolled_speakers, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not save voiceprint vault: {e}")

    def _load_vault(self):
        if not self.storage_path or not os.path.exists(self.storage_path):
            return
        try:
            with open(self.storage_path, "r") as f:
                self.enrolled_speakers = json.load(f)
            logger.info(f"Loaded {len(self.enrolled_speakers)} voiceprint profile(s) from vault.")
        except Exception as e:
            logger.warning(f"Could not load voiceprint vault: {e}")

    def _seed_default_cxo_if_empty(self):
        """Seeds default CXO executive profiles for out-of-the-box demo testing."""
        if len(self.enrolled_speakers) > 0:
            return

        # Try to load authentic audio sample for Vikram Sharma
        sample_path = str(PROJECT_ROOT / "public" / "samples" / "real_human_voice.m4a")
        if os.path.exists(sample_path):
            try:
                from api.detector import load_audio_from_bytes_or_path
                audio, _, _ = load_audio_from_bytes_or_path(sample_path)
                # Enroll first 2.5 seconds as Vikram Sharma's golden voiceprint
                cxo_audio = audio[:int(16000 * 2.5)]
                self.enroll_speaker(
                    speaker_id="cxo_vikram_sharma",
                    name="Vikram Sharma",
                    role="Chief Financial Officer (Global Treasury)",
                    audio=cxo_audio,
                    authorized_limit="₹ 5,00,00,000"
                )
                logger.info("Successfully seeded default profile: Vikram Sharma (CFO)")
            except Exception as e:
                logger.warning(f"Could not seed default CXO profile: {e}")


# Global Biometrics Singleton
biometrics_engine = SpeakerBiometricsEngine()

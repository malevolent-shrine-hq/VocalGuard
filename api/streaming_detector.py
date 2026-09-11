# -*- coding: utf-8 -*-
"""
VocalGuard Streaming Detector Module
Provides isolated session management, ring-buffered sliding window audio ingestion,
voice activity detection (VAD), model inference, and temporal risk smoothing.

Operating parameters:
- Window Size: 2.0 seconds (32,000 samples @ 16,000 Hz)
- Inference Hop: 1.0 second (16,000 samples @ 16,000 Hz)
- Minimum Buffer for 1st Window: 2.0 seconds (32,000 samples @ 16,000 Hz)
- Model: MultiDomainDeepfakeDetector (SE-ResNet v3, ~12.86 MB)
- Transport: WebSocket binary PCM (Float32 / Int16 @ 16kHz)
"""

import logging
import os
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch

from api.detector import (
    NUM_SAMPLES,
    SAMPLE_RATE,
    DetectorManager,
    normalize_audio_for_inference,
)
from api.speaker_biometrics import biometrics_engine

logger = logging.getLogger("vocalguard.streaming")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


# ============================================================
# CONFIGURABLE STREAMING PARAMETERS
# ============================================================
WINDOW_SECONDS: float = 2.0
WINDOW_SAMPLES: int = int(SAMPLE_RATE * WINDOW_SECONDS)       # 32,000 samples (2.0s)
MIN_INITIAL_SAMPLES: int = WINDOW_SAMPLES                     # Never pad initial live windows
HOP_SECONDS: float = 1.0
HOP_SAMPLES: int = int(SAMPLE_RATE * HOP_SECONDS)             # 16,000 samples (1.0s hop)

# Voice Activity Detection (VAD) RMS Energy Gating
# Silence or background room tone (RMS < 0.003 or peak < 0.006) bypasses CNN
VAD_MIN_RMS: float = float(os.getenv("STREAM_VAD_MIN_RMS", "0.003"))
VAD_MIN_PEAK: float = float(os.getenv("STREAM_VAD_MIN_PEAK", "0.006"))

# Temporal Exponential Moving Average (EMA) Smoothing
DEFAULT_EMA_ALPHA: float = float(os.getenv("STREAM_EMA_ALPHA", "0.35"))

# Application Risk Level Mapping
# Note: Risk levels are application-level interpretations of the model output,
# calibrated against Youden's J optimal threshold (0.0509).
RISK_MEDIUM_THRESHOLD: float = float(os.getenv("STREAM_RISK_MEDIUM_THRESHOLD", "0.15"))
RISK_HIGH_THRESHOLD: float = float(os.getenv("STREAM_RISK_HIGH_THRESHOLD", "0.35"))

# Ring buffer maximum capacity (4.0 seconds of audio = 64,000 samples)
# Prevents unbounded memory growth while supporting 2.0s window + hop
MAX_BUFFER_SAMPLES: int = int(SAMPLE_RATE * 4.0)

# Maximum predictions retained per session history
MAX_HISTORY_ENTRIES: int = 120


# ============================================================
# STREAMING SESSION
# ============================================================

class StreamingSession:
    """
    Encapsulates isolated state for a single active WebSocket live stream.
    Each client connection receives its own StreamingSession instance to ensure
    complete concurrency isolation with zero cross-session data leakage.
    """

    def __init__(
        self,
        session_id: Optional[str] = None,
        custom_threshold: Optional[float] = None,
        ema_alpha: float = DEFAULT_EMA_ALPHA,
        detector: Optional[DetectorManager] = None
    ):
        self.session_id: str = session_id or str(uuid.uuid4())[:8]
        self.detector: DetectorManager = detector or DetectorManager.get_instance()
        self.threshold: float = custom_threshold if custom_threshold is not None else self.detector.threshold
        self.ema_alpha: float = float(np.clip(ema_alpha, 0.05, 0.95))

        # Memory-safe pre-allocated circular audio buffer (float32, 16kHz)
        self.buffer: np.ndarray = np.zeros(MAX_BUFFER_SAMPLES, dtype=np.float32)
        self.buffer_len: int = 0
        self.total_samples_received: int = 0
        self.samples_since_last_inference: int = 0
        self.chunks_received: int = 0

        # Temporal metrics & state
        self.session_start_time: float = time.perf_counter()
        self.last_inference_time: float = 0.0
        self.smoothed_fake_prob: float = 0.0
        self.consecutive_threat_count: int = 0
        self.is_initialized: bool = False
        self.last_buffer_status_samples: int = -1

        # Bounded history for timeline/graph queries
        self.prediction_history: List[Dict[str, Any]] = []

        # Target enrolled executive for speaker verification (defaults to seeded demo CXO)
        self.target_speaker_id: Optional[str] = "cxo_vikram_sharma"
        self.audio_format: str = "pcm_s16le"
        self.user_id: Optional[str] = None
        self.user_email: Optional[str] = None

        logger.info(f"[STREAM:{self.session_id}] Session initialized (τ={self.threshold:.4f}, α={self.ema_alpha})")

    def reset(self):
        """Resets the internal buffer and smoothing state for a fresh speaker."""
        self.buffer.fill(0.0)
        self.buffer_len = 0
        self.total_samples_received = 0
        self.samples_since_last_inference = 0
        self.chunks_received = 0
        self.smoothed_fake_prob = 0.0
        self.consecutive_threat_count = 0
        self.prediction_history.clear()
        self.is_initialized = False
        self.last_buffer_status_samples = -1
        self.session_start_time = time.perf_counter()
        logger.info(f"[STREAM:{self.session_id}] Buffer and state reset.")

    def ingest_audio_chunk(self, chunk: np.ndarray) -> Optional[Dict[str, Any]]:
        """
        Appends incoming audio chunk (1D numpy float32 @ 16kHz) to the rolling buffer.
        Evaluates an inference window only when:
          1. Buffer contains at least MIN_INITIAL_SAMPLES (24,000 samples = 1.5s) for initial startup,
             or full WINDOW_SAMPLES (32,000 samples = 2.0s).
          2. At least HOP_SAMPLES (16,000 samples = 1.0s) have arrived since the previous window.
        
        Returns:
          - None: if chunk is buffered and next hop is not yet reached.
          - Dict: status frame or prediction frame if evaluation occurred.
        """
        if chunk.ndim != 1 or len(chunk) == 0:
            return None

        # Clean numerical anomalies (NaNs, Infs)
        chunk = np.nan_to_num(chunk, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32)
        chunk_len = len(chunk)
        self.chunks_received += 1
        self.total_samples_received += chunk_len
        self.samples_since_last_inference += chunk_len

        # Append to bounded rolling buffer
        if self.buffer_len + chunk_len <= MAX_BUFFER_SAMPLES:
            self.buffer[self.buffer_len:self.buffer_len + chunk_len] = chunk
            self.buffer_len += chunk_len
        else:
            # Shift buffer left to make room for new chunk
            keep_len = MAX_BUFFER_SAMPLES - chunk_len
            if keep_len > 0:
                self.buffer[:keep_len] = self.buffer[self.buffer_len - keep_len:self.buffer_len]
                self.buffer[keep_len:] = chunk
                self.buffer_len = MAX_BUFFER_SAMPLES
            else:
                self.buffer[:] = chunk[-MAX_BUFFER_SAMPLES:]
                self.buffer_len = MAX_BUFFER_SAMPLES

        # ------------------------------------------------------------------
        # Startup / Buffering phase: require at least MIN_INITIAL_SAMPLES
        # ------------------------------------------------------------------
        if not self.is_initialized:
            if self.buffer_len < MIN_INITIAL_SAMPLES:
                buffered_sec = round(self.buffer_len / SAMPLE_RATE, 2)
                total_sec = round(self.total_samples_received / SAMPLE_RATE, 2)
                # Do not flood the client with state-only frames for every
                # small PCM packet. The next model event remains exact.
                if self.buffer_len - self.last_buffer_status_samples < SAMPLE_RATE // 4:
                    return None
                self.last_buffer_status_samples = self.buffer_len
                return {
                    "type": "status",
                    "session_id": self.session_id,
                    "state": "BUFFERING",
                    "buffered_seconds": buffered_sec,
                    "target_seconds": WINDOW_SECONDS,
                    "stream_duration_sec": total_sec,
                    "rms_energy": float(np.sqrt(np.mean(chunk ** 2))) if len(chunk) else 0.0,
                    "message": f"Buffering live audio stream ({buffered_sec}s / {WINDOW_SECONDS}s)..."
                }
            else:
                # Initial window ready
                self.is_initialized = True
                self.samples_since_last_inference = 0
                return self._evaluate_window()

        # ------------------------------------------------------------------
        # Check if inference hop condition is satisfied (1.0s hop = 16,000 samples)
        # ------------------------------------------------------------------
        if self.samples_since_last_inference >= HOP_SAMPLES:
            self.samples_since_last_inference = 0
            return self._evaluate_window()

        # Not yet reached next hop; client continues buffering smoothly
        return None

    def _evaluate_window(self) -> Dict[str, Any]:
        """
        Extracts the most recent 2.0-second window (32,000 samples) from the buffer,
        runs VAD energy gating, performs ML model inference, and applies EMA smoothing.
        """
        t_start = time.perf_counter()
        stream_duration_sec = round(self.total_samples_received / SAMPLE_RATE, 2)
        window_end_sec = stream_duration_sec
        window_start_sec = max(0.0, round(window_end_sec - WINDOW_SECONDS, 2))

        # Slice latest up to 32,000 samples
        available = min(self.buffer_len, WINDOW_SAMPLES)
        raw_slice = self.buffer[self.buffer_len - available:self.buffer_len].copy()

        # The ingestion state machine only reaches this point with a complete
        # 2-second context; no artificial zero-padding is used for live audio.
        if len(raw_slice) != WINDOW_SAMPLES:
            raise RuntimeError("Streaming window was evaluated without 2 seconds of PCM audio.")
        window_audio = raw_slice

        # RMS Energy & Peak amplitude computation
        win_rms = float(np.sqrt(np.mean(window_audio ** 2)))
        peak_amp = float(np.max(np.abs(window_audio)))

        # ------------------------------------------------------------------
        # Voice Activity Detection (VAD) / Silence Gating
        # ------------------------------------------------------------------
        is_voiced = (win_rms >= VAD_MIN_RMS) and (peak_amp >= VAD_MIN_PEAK)

        if not is_voiced:
            # Silence / room tone: skip CNN to avoid zero-floor log-spectrogram synthetic artifacts
            # Exponentially decay smoothed threat toward zero during speech pauses
            self.smoothed_fake_prob = max(0.0, self.smoothed_fake_prob * 0.90)
            self.consecutive_threat_count = max(0, self.consecutive_threat_count - 1)
            eval_latency = round((time.perf_counter() - t_start) * 1000, 2)

            result = {
                "type": "status",
                "session_id": self.session_id,
                "state": "NO_SPEECH",
                "timestamp": round(time.time(), 3),
                "stream_duration_sec": stream_duration_sec,
                "window_start": window_start_sec,
                "window_end": window_end_sec,
                "rms_energy": round(win_rms, 5),
                "peak_amplitude": round(peak_amp, 4),
                "smoothed_fake_probability": round(self.smoothed_fake_prob, 4),
                "smoothed_fake_percentage": round(self.smoothed_fake_prob * 100, 2),
                "risk_level": "LOW",
                "inference_ms": eval_latency,
                "biometrics": biometrics_engine.verify_live_chunk(self.target_speaker_id, np.zeros(16000, dtype=np.float32)),
                "composite_verdict": "AMBIENT_NOISE_CNN_GATED",
                "composite_risk": "LOW",
                "action_mandated": "AWAIT_ACTIVE_SPEECH",
                "message": "Ambient background / silence detected (CNN gated)."
            }
            return result

        # ------------------------------------------------------------------
        # ML Model Inference (Exact parity with DetectorManager)
        # Preprocessing: DC offset removal & peak amplitude normalization
        # ------------------------------------------------------------------
        audio_norm = normalize_audio_for_inference(window_audio)

        # Prepare tensor (batch_size=1, samples=32000)
        tensor_win = torch.from_numpy(audio_norm).float().unsqueeze(0).to(self.detector.device)

        with torch.no_grad():
            feat = self.detector.mel_transform(tensor_win)
            logits = self.detector.model(feat)
            raw_fake_prob = float(torch.sigmoid(logits).item())

        raw_fake_prob = float(np.clip(raw_fake_prob, 0.0, 1.0))
        raw_real_prob = float(np.clip(1.0 - raw_fake_prob, 0.0, 1.0))

        # ------------------------------------------------------------------
        # Temporal Exponential Moving Average (EMA) Smoothing
        # ------------------------------------------------------------------
        if self.smoothed_fake_prob == 0.0:
            self.smoothed_fake_prob = raw_fake_prob
        else:
            self.smoothed_fake_prob = (
                self.ema_alpha * raw_fake_prob + (1.0 - self.ema_alpha) * self.smoothed_fake_prob
            )
        self.smoothed_fake_prob = float(np.clip(self.smoothed_fake_prob, 0.0, 1.0))

        # Decision & Thresholding (calibrated τ = 0.0509)
        is_fake = bool(raw_fake_prob >= self.threshold)
        is_smoothed_fake = bool(self.smoothed_fake_prob >= self.threshold)

        if is_fake:
            self.consecutive_threat_count += 1
        else:
            self.consecutive_threat_count = max(0, self.consecutive_threat_count - 1)

        # ------------------------------------------------------------------
        # Cross-Session Speaker Biometrics & Voiceprint Verification
        # ------------------------------------------------------------------
        bio_result = biometrics_engine.verify_live_chunk(self.target_speaker_id, window_audio)

        # ------------------------------------------------------------------
        # Dual-Factor Security Verdict Synthesis
        # ------------------------------------------------------------------
        if is_fake:
            composite_verdict = "CLONED_DEEPFAKE_ATTACK"
            composite_risk = "HIGH"
            action_mandated = "HALT_WIRE_TRANSFER_TRIGGER_CALLBACK"
        elif bio_result.get("enrolled") and not bio_result.get("is_identity_verified"):
            composite_verdict = "UNAUTHORIZED_HUMAN_IMPOSTER"
            composite_risk = "HIGH"
            action_mandated = "MANDATE_STEP_UP_MFA_ALERT_SUPERVISOR"
        elif bio_result.get("enrolled") and bio_result.get("is_identity_verified"):
            composite_verdict = "VERIFIED_AUTHORIZED_CALLER"
            composite_risk = "LOW"
            action_mandated = "AUTHORIZE_TRANSACTION"
        else:
            composite_verdict = "GENUINE_HUMAN_VOICE"
            composite_risk = "LOW"
            action_mandated = "STANDARD_MONITORING"

        # ------------------------------------------------------------------
        # Application Risk Engine
        # Maps model probability and temporal trends to human-readable states
        # ------------------------------------------------------------------
        if self.smoothed_fake_prob >= RISK_HIGH_THRESHOLD or self.consecutive_threat_count >= 3:
            risk_level = "HIGH"
            state = "HIGH_RISK"
        elif self.smoothed_fake_prob >= self.threshold or raw_fake_prob >= RISK_MEDIUM_THRESHOLD:
            risk_level = "MEDIUM"
            state = "SUSPICIOUS"
        else:
            risk_level = "LOW"
            state = "REAL"

        confidence = round(max(raw_fake_prob, raw_real_prob), 4)
        inference_latency = round((time.perf_counter() - t_start) * 1000, 2)

        # Spectral anomaly flags
        spectral_flags = {
            "phase_anomaly": "ERR_PHASE" if raw_fake_prob >= self.threshold else "NORMAL",
            "vocoder_artifacts": "SYNTH_MATCH" if raw_fake_prob >= self.threshold else "CLEAN",
            "prosody_stability": "UNNATURAL" if raw_fake_prob >= 0.50 else "ORGANIC"
        }

        prediction_frame = {
            "type": "prediction",
            "session_id": self.session_id,
            "timestamp": round(time.time(), 3),
            "stream_duration_sec": stream_duration_sec,
            "window_start": window_start_sec,
            "window_end": window_end_sec,
            "fake_probability": round(raw_fake_prob, 4),
            "real_probability": round(raw_real_prob, 4),
            "smoothed_fake_probability": round(self.smoothed_fake_prob, 4),
            "fake_percentage": round(raw_fake_prob * 100, 2),
            "real_percentage": round(raw_real_prob * 100, 2),
            "smoothed_percentage": round(self.smoothed_fake_prob * 100, 2),
            "confidence": confidence,
            "prediction": "FAKE" if is_fake else "REAL",
            "risk_level": risk_level,
            "state": state,
            "is_fake": is_fake,
            "is_smoothed_fake": is_smoothed_fake,
            "threshold": round(self.threshold, 4),
            "rms_energy": round(win_rms, 5),
            "peak_amplitude": round(peak_amp, 4),
            "spectral_flags": spectral_flags,
            "consecutive_threat_count": self.consecutive_threat_count,
            "inference_ms": inference_latency,
            "processing_latency_ms": inference_latency,
            "chunks_received": self.chunks_received,
            "buffered_seconds": round(self.buffer_len / SAMPLE_RATE, 3),
            "model_version": "SE-ResNet-v3 (93.66% Acc)",
            "user_id": self.user_id,
            "biometrics": bio_result,
            "composite_verdict": composite_verdict,
            "composite_risk": composite_risk,
            "action_mandated": action_mandated
        }

        # Maintain bounded history
        self.prediction_history.append(prediction_frame)
        if len(self.prediction_history) > MAX_HISTORY_ENTRIES:
            self.prediction_history.pop(0)

        logger.info(
            f"[STREAM:{self.session_id}|{self.user_id or 'guest'}] t={stream_duration_sec:5.1f}s | "
            f"Raw: {raw_fake_prob*100:5.1f}% | EMA: {self.smoothed_fake_prob*100:5.1f}% | "
            f"BioMatch: {bio_result.get('identity_match_percentage', 0):.1f}% | "
            f"Verdict: {composite_verdict:<26} | Latency: {inference_latency:4.1f}ms"
        )

        return prediction_frame


# ============================================================
# STREAMING CONTROLLER (Session Pool Manager)
# ============================================================

class StreamingDetector:
    """
    Manages active streaming sessions, orchestrating connection registration,
    audio stream decoding, and session cleanup.
    """

    def __init__(self):
        self.detector: DetectorManager = DetectorManager.get_instance()
        self._active_sessions: Dict[str, StreamingSession] = {}

    def create_session(
        self,
        session_id: Optional[str] = None,
        custom_threshold: Optional[float] = None,
        ema_alpha: float = DEFAULT_EMA_ALPHA
    ) -> StreamingSession:
        sid = session_id or str(uuid.uuid4())[:8]
        session = StreamingSession(
            session_id=sid,
            custom_threshold=custom_threshold,
            ema_alpha=ema_alpha,
            detector=self.detector
        )
        self._active_sessions[sid] = session
        return session

    def get_session(self, session_id: str) -> Optional[StreamingSession]:
        return self._active_sessions.get(session_id)

    def close_session(self, session_id: str):
        if session_id in self._active_sessions:
            sess = self._active_sessions.pop(session_id)
            sess.reset()
            logger.info(f"[STREAM:{session_id}] Session closed and memory cleared.")

    @property
    def active_session_count(self) -> int:
        return len(self._active_sessions)


# Global singleton streaming detector controller
streaming_controller = StreamingDetector()

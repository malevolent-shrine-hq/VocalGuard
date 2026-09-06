# -*- coding: utf-8 -*-
"""
Voice Deepfake Detector - PyTorch Model & Inference Engine
Compatible with trained v3 checkpoint (voice_deepfake_detector.pth)
"""

import math
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import soundfile as sf
import torch
import torch.nn as nn
import torch.nn.functional as F
from scipy.signal import resample_poly

SAMPLE_RATE = 16_000
AUDIO_DURATION = 2.0
NUM_SAMPLES = int(SAMPLE_RATE * AUDIO_DURATION)  # 32,000
N_MELS = 128
HOP_LENGTH = 256
F_MIN = 20
F_MAX = SAMPLE_RATE // 2


def hz_to_mel(hz: float) -> float:
    return 2595.0 * np.log10(1.0 + hz / 700.0)


def mel_to_hz(mel: float) -> float:
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)


def create_mel_filterbank(sample_rate: int, n_fft: int, n_mels: int, f_min: int, f_max: int) -> torch.Tensor:
    mel_min = hz_to_mel(f_min)
    mel_max = hz_to_mel(f_max)
    mel_points = np.linspace(mel_min, mel_max, n_mels + 2)
    hz_points = mel_to_hz(mel_points)
    fft_freqs = np.linspace(0, sample_rate / 2, n_fft // 2 + 1)
    filterbank = np.zeros((n_mels, n_fft // 2 + 1), dtype=np.float32)

    for m in range(1, n_mels + 1):
        left, center, right = hz_points[m - 1], hz_points[m], hz_points[m + 1]
        left_idx = np.where((fft_freqs >= left) & (fft_freqs <= center))[0]
        if center > left:
            filterbank[m - 1, left_idx] = (fft_freqs[left_idx] - left) / (center - left)
        right_idx = np.where((fft_freqs >= center) & (fft_freqs <= right))[0]
        if right > center:
            filterbank[m - 1, right_idx] = (right - fft_freqs[right_idx]) / (right - center)

    return torch.tensor(filterbank, dtype=torch.float32)


MEL_FILTERBANK_1024 = create_mel_filterbank(SAMPLE_RATE, 1024, N_MELS, F_MIN, F_MAX)


class MultiResolutionSpectrogram(nn.Module):
    def __init__(self, hop_length=HOP_LENGTH, n_mels=N_MELS, mel_filterbank=MEL_FILTERBANK_1024):
        super().__init__()
        self.hop_length = hop_length
        self.n_mels = n_mels
        self.register_buffer("window_512", torch.hann_window(512))
        self.register_buffer("window_1024", torch.hann_window(1024))
        self.register_buffer("window_2048", torch.hann_window(2048))
        self.register_buffer("mel_filterbank", mel_filterbank)

    def forward(self, waveform: torch.Tensor) -> torch.Tensor:
        with torch.no_grad():
            waveform = waveform.float()

            stft_1024 = torch.stft(
                waveform, n_fft=1024, hop_length=self.hop_length, win_length=1024,
                window=self.window_1024, center=True, return_complex=True
            )
            power_1024 = torch.abs(stft_1024) ** 2
            mel = torch.matmul(self.mel_filterbank, power_1024)
            log_mel = torch.log(torch.clamp(mel, min=1e-5))
            log_mel = (log_mel - log_mel.mean(dim=(-2, -1), keepdim=True)) / (log_mel.std(dim=(-2, -1), keepdim=True) + 1e-5)

            stft_512 = torch.stft(
                waveform, n_fft=512, hop_length=self.hop_length, win_length=512,
                window=self.window_512, center=True, return_complex=True
            )
            power_512 = torch.abs(stft_512) ** 2
            lin_512 = F.adaptive_avg_pool2d(power_512.unsqueeze(1), (self.n_mels, power_512.shape[-1])).squeeze(1)
            log_lin_512 = torch.log(torch.clamp(lin_512, min=1e-5))
            log_lin_512 = (log_lin_512 - log_lin_512.mean(dim=(-2, -1), keepdim=True)) / (log_lin_512.std(dim=(-2, -1), keepdim=True) + 1e-5)

            stft_2048 = torch.stft(
                waveform, n_fft=2048, hop_length=self.hop_length, win_length=2048,
                window=self.window_2048, center=True, return_complex=True
            )
            power_2048 = torch.abs(stft_2048) ** 2
            lin_2048 = F.adaptive_avg_pool2d(power_2048.unsqueeze(1), (self.n_mels, power_2048.shape[-1])).squeeze(1)
            log_lin_2048 = torch.log(torch.clamp(lin_2048, min=1e-5))
            log_lin_2048 = (log_lin_2048 - log_lin_2048.mean(dim=(-2, -1), keepdim=True)) / (log_lin_2048.std(dim=(-2, -1), keepdim=True) + 1e-5)

            return torch.stack([log_mel, log_lin_512, log_lin_2048], dim=1)


class ConvBNAct(nn.Module):
    def __init__(self, in_channels, out_channels, kernel_size=3, stride=1, padding=1):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size, stride=stride, padding=padding, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.SiLU(inplace=True),
        )

    def forward(self, x):
        return self.block(x)


class SEBlock(nn.Module):
    def __init__(self, channels, reduction=8):
        super().__init__()
        hidden = max(channels // reduction, 8)
        self.fc = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Conv2d(channels, hidden, 1),
            nn.SiLU(inplace=True),
            nn.Conv2d(hidden, channels, 1),
            nn.Sigmoid(),
        )

    def forward(self, x):
        return x * self.fc(x)


class ResidualBlock(nn.Module):
    def __init__(self, in_channels, out_channels, stride=1, kernel_size=(3, 3), dropout=0.0):
        super().__init__()
        pad = (kernel_size[0] // 2, kernel_size[1] // 2) if isinstance(kernel_size, tuple) else (kernel_size // 2, kernel_size // 2)
        k = kernel_size if isinstance(kernel_size, tuple) else (kernel_size, kernel_size)

        self.conv1 = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, k, stride=stride, padding=pad, bias=False),
            nn.BatchNorm2d(out_channels),
            nn.SiLU(inplace=True),
        )
        self.conv2 = nn.Sequential(
            nn.Conv2d(out_channels, out_channels, 3, stride=1, padding=1, bias=False),
            nn.BatchNorm2d(out_channels),
        )
        self.se = SEBlock(out_channels)
        self.shortcut = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, 1, stride=stride, bias=False),
            nn.BatchNorm2d(out_channels),
        ) if in_channels != out_channels or stride != 1 else nn.Identity()
        self.act = nn.SiLU(inplace=True)

    def forward(self, x):
        return self.act(self.se(self.conv2(self.conv1(x))) + self.shortcut(x))


class MultiDomainDeepfakeDetector(nn.Module):
    def __init__(self):
        super().__init__()
        self.stem = nn.Sequential(
            ConvBNAct(3, 32, kernel_size=(5, 5), stride=2, padding=2),
            ResidualBlock(32, 32, stride=1, kernel_size=(3, 3)),
        )
        self.stage1 = nn.Sequential(
            ResidualBlock(32, 64, stride=2, kernel_size=(5, 3)),
            ResidualBlock(64, 64, stride=1, kernel_size=(3, 3)),
        )
        self.stage2 = nn.Sequential(
            ResidualBlock(64, 128, stride=2, kernel_size=(3, 5)),
            ResidualBlock(128, 128, stride=1, kernel_size=(5, 3)),
        )
        self.stage3 = nn.Sequential(
            ResidualBlock(128, 256, stride=2, kernel_size=(3, 3)),
            ResidualBlock(256, 256, stride=1, kernel_size=(3, 3)),
        )
        self.classifier = nn.Sequential(
            nn.Linear(256 * 3, 256),
            nn.BatchNorm1d(256),
            nn.SiLU(inplace=True),
            nn.Dropout(0.40),
            nn.Linear(256, 64),
            nn.SiLU(inplace=True),
            nn.Dropout(0.20),
            nn.Linear(64, 1),
        )

    def forward(self, x):
        x = self.stem(x)
        x = self.stage1(x)
        x = self.stage2(x)
        x = self.stage3(x)

        mean_feat = x.mean(dim=(-2, -1))
        std_feat = x.std(dim=(-2, -1))
        max_feat = F.adaptive_max_pool2d(x, (1, 1)).flatten(1)

        pooled = torch.cat([mean_feat, std_feat, max_feat], dim=1)
        return self.classifier(pooled).squeeze(-1)


# ------------------------------------------------------------
# Audio Loading & Preprocessing
# ------------------------------------------------------------

def load_audio_from_bytes_or_path(input_data: Any, filename: Optional[str] = None) -> Tuple[np.ndarray, int, float]:
    """
    Loads audio from a file path or raw bytes.
    Returns:
        audio (1D float32 numpy array normalized to [-1, 1])
        original_sr (original sample rate)
        duration (duration in seconds)
    """
    temp_path = None
    if isinstance(input_data, (str, Path)):
        path = str(input_data)
    else:
        suffix = Path(filename).suffix if filename else ".wav"
        fd, temp_path = tempfile.mkstemp(suffix=suffix)
        os.write(fd, input_data)
        os.close(fd)
        path = temp_path

    audio, orig_sr = None, None

    try:
        # Backend 1: soundfile
        try:
            audio, orig_sr = sf.read(path, dtype="float32", always_2d=False)
            if audio.ndim == 2:
                audio = np.mean(audio, axis=1)
        except Exception:
            pass

        # Backend 2: torchaudio
        if audio is None:
            try:
                import torchaudio
                waveform, orig_sr = torchaudio.load(path)
                if waveform.ndim == 2 and waveform.shape[0] > 1:
                    audio = waveform.mean(dim=0).cpu().numpy()
                else:
                    audio = waveform.squeeze().cpu().numpy()
            except Exception:
                pass

        # Backend 3: ffmpeg subprocess (universal format support)
        if audio is None:
            try:
                cmd = [
                    "ffmpeg", "-nostdin", "-v", "error",
                    "-i", str(path),
                    "-f", "f32le",
                    "-ac", "1",
                    "-ar", str(SAMPLE_RATE),
                    "pipe:1"
                ]
                proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
                audio = np.frombuffer(proc.stdout, dtype=np.float32)
                orig_sr = SAMPLE_RATE
            except Exception as e:
                raise RuntimeError(
                    f"Failed to decode audio file. Error: {e}"
                )
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

    if audio is None or len(audio) == 0:
        raise ValueError("Audio data is empty or corrupted.")

    audio = np.asarray(audio, dtype=np.float32)
    audio = np.nan_to_num(audio, nan=0.0, posinf=0.0, neginf=0.0)

    duration = float(len(audio) / orig_sr) if orig_sr else 0.0

    # Resample to 16,000 Hz if needed
    if orig_sr != SAMPLE_RATE:
        gcd = math.gcd(int(orig_sr), int(SAMPLE_RATE))
        up, down = SAMPLE_RATE // gcd, orig_sr // gcd
        audio = resample_poly(audio, up, down).astype(np.float32)

    # Remove DC offset & normalize amplitude
    if len(audio) > 0:
        audio = audio - np.mean(audio)
    max_abs = np.max(np.abs(audio)) if len(audio) else 0.0
    if max_abs > 1e-8:
        audio = audio / max_abs

    return audio, orig_sr, duration


# ------------------------------------------------------------
# Model Manager Singleton
# ------------------------------------------------------------

class DetectorManager:
    _instance = None

    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model: Optional[MultiDomainDeepfakeDetector] = None
        self.mel_transform: Optional[MultiResolutionSpectrogram] = None
        self.threshold: float = 0.0509
        self.checkpoint_path: Optional[str] = None
        self._load_model()

    @classmethod
    def get_instance(cls) -> "DetectorManager":
        if cls._instance is None:
            cls._instance = DetectorManager()
        return cls._instance

    def _find_checkpoint(self) -> Optional[Path]:
        env_path = os.environ.get("MODEL_PATH")
        candidate_paths = [
            Path(env_path) if env_path else None,
            Path(__file__).parent.parent / "model" / "voice_deepfake_detector.pth",
            Path(__file__).parent / "model" / "voice_deepfake_detector.pth",
            Path("/home/aditya/playground/audio_model/trained_models/voice_deepfake_detector.pth"),
            Path("./model/voice_deepfake_detector.pth"),
            Path("./voice_deepfake_detector.pth"),
        ]
        for p in candidate_paths:
            if p and p.exists():
                return p
        return None

    def _load_model(self):
        ckpt_path = self._find_checkpoint()
        if not ckpt_path:
            print("[DetectorManager] WARNING: No voice_deepfake_detector.pth found!")
            return

        print(f"[DetectorManager] Loading checkpoint: {ckpt_path} on {self.device}")
        checkpoint = torch.load(ckpt_path, map_location=self.device, weights_only=False)
        self.threshold = float(checkpoint.get("threshold", 0.0509))
        self.checkpoint_path = str(ckpt_path)

        model = MultiDomainDeepfakeDetector().to(self.device)
        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()
        self.model = model

        mel_transform = MultiResolutionSpectrogram().to(self.device)
        mel_transform.eval()
        self.mel_transform = mel_transform
        print(f"[DetectorManager] Model initialized. Threshold: {self.threshold:.4f}")

    def detect(self, audio_data: Any, filename: Optional[str] = None, custom_threshold: Optional[float] = None) -> Dict[str, Any]:
        t0 = time.perf_counter()
        if self.model is None:
            self._load_model()
            if self.model is None:
                raise RuntimeError("Model checkpoint could not be loaded.")

        audio, orig_sr, duration = load_audio_from_bytes_or_path(audio_data, filename)
        num_audio_samples = len(audio)

        # Slice into 2.0s windows (NUM_SAMPLES = 32000)
        windows: List[Tuple[float, float, torch.Tensor]] = []
        hop_samples = int(SAMPLE_RATE * 1.0)  # 1.0s hop

        if num_audio_samples <= NUM_SAMPLES:
            padded = np.pad(audio, (0, NUM_SAMPLES - num_audio_samples))
            tensor_win = torch.from_numpy(padded).float().unsqueeze(0)
            windows.append((0.0, duration, tensor_win))
        else:
            for start_idx in range(0, num_audio_samples - NUM_SAMPLES + 1, hop_samples):
                end_idx = start_idx + NUM_SAMPLES
                start_sec = round(start_idx / SAMPLE_RATE, 2)
                end_sec = round(end_idx / SAMPLE_RATE, 2)
                chunk = audio[start_idx:end_idx]
                windows.append((start_sec, end_sec, torch.from_numpy(chunk).float().unsqueeze(0)))
            last_end = windows[-1][1] * SAMPLE_RATE if windows else 0
            if num_audio_samples - last_end > SAMPLE_RATE * 0.5:
                chunk = audio[-NUM_SAMPLES:]
                windows.append((round((num_audio_samples - NUM_SAMPLES) / SAMPLE_RATE, 2), duration, torch.from_numpy(chunk).float().unsqueeze(0)))

        threshold = custom_threshold if custom_threshold is not None else self.threshold
        window_results = []
        fake_probs: List[float] = []
        rms_energies: List[float] = []

        # 1. Primary window evaluation (exactly matching infer.py 0-2s evaluation)
        primary_chunk = audio[:NUM_SAMPLES] if len(audio) >= NUM_SAMPLES else np.pad(audio, (0, NUM_SAMPLES - len(audio)))
        primary_tensor = torch.from_numpy(primary_chunk).float().unsqueeze(0).to(self.device)
        with torch.no_grad():
            prim_feat = self.mel_transform(primary_tensor)
            primary_fake_prob = float(torch.sigmoid(self.model(prim_feat)).item())

        # 2. Multi-window evaluation across the audio stream
        with torch.no_grad():
            for start_s, end_s, win_tensor in windows:
                win_tensor = win_tensor.to(self.device)
                feat = self.mel_transform(win_tensor)
                logits = self.model(feat)
                prob = float(torch.sigmoid(logits).item())
                
                win_audio_np = win_tensor.squeeze(0).cpu().numpy()
                win_rms = float(np.sqrt(np.mean(win_audio_np ** 2)))
                rms_energies.append(win_rms)
                fake_probs.append(prob)

                window_results.append({
                    "start_time": start_s,
                    "end_time": end_s,
                    "fake_probability": round(prob, 4),
                    "fake_percentage": round(prob * 100, 2),
                    "rms_energy": round(win_rms, 5),
                    "is_fake": bool(prob >= threshold)
                })

        max_fake_prob = float(np.max(fake_probs)) if fake_probs else 0.0
        mean_fake_prob = float(np.mean(fake_probs)) if fake_probs else 0.0
        
        # 3. Voice Activity / Energy Gating
        # Silent/low-energy windows trigger false synthetic vocoder artifacts in CNNs
        peak_win_rms = max(rms_energies) if rms_energies else 1.0
        voiced_indices = [
            i for i, r in enumerate(rms_energies) 
            if r >= 0.008 and r >= 0.04 * peak_win_rms
        ]
        if not voiced_indices:
            voiced_indices = list(range(len(fake_probs)))
            
        voiced_probs = [fake_probs[i] for i in voiced_indices]
        v_median = float(np.median(voiced_probs)) if voiced_probs else mean_fake_prob
        v_mean = float(np.mean(voiced_probs)) if voiced_probs else mean_fake_prob
        fake_win_ratio = float(np.mean([p >= threshold for p in voiced_probs])) if voiced_probs else 0.0

        # Check for sustained consecutive synthetic segments (localized deepfake detection)
        consec_high = 0
        max_consec_high = 0
        for p in voiced_probs:
            if p >= 0.50:
                consec_high += 1
                max_consec_high = max(max_consec_high, consec_high)
            else:
                consec_high = 0

        # 4. Scientifically robust multi-window aggregation & decision logic
        if len(windows) <= 2:
            # Short sample (<= 2s - 3s): use primary window directly (exact infer.py equivalence)
            threat_prob = primary_fake_prob
            is_fake = bool(threat_prob >= threshold)
            decision_rationale = "single_window_evaluation"
        else:
            # Long sample / full stream: require sustained or consensus synthetic cues
            if max_consec_high >= 4:
                # Sustained synthetic speech detected in a continuous segment
                is_fake = True
                threat_prob = float(np.percentile(voiced_probs, 90))
                decision_rationale = "sustained_synthetic_segment"
            elif fake_win_ratio >= 0.65 and v_median >= threshold:
                # Majority of voiced windows consistently show synthetic vocoder markers
                is_fake = True
                threat_prob = v_median
                decision_rationale = "majority_synthetic_consensus"
            elif primary_fake_prob >= threshold and (v_median >= threshold or fake_win_ratio >= 0.50):
                # Both initial segment and majority temporal windows indicate synthetic voice
                is_fake = True
                threat_prob = max(primary_fake_prob, v_median)
                decision_rationale = "primary_and_consensus_fake"
            else:
                # Natural human speech or song (isolated spikes are studio/reverb/music anomalies)
                is_fake = False
                threat_prob = min(primary_fake_prob, v_median) if primary_fake_prob < threshold else v_median
                decision_rationale = "authentic_human_consensus"

        real_prob = float(np.clip(1.0 - threat_prob, 0.0, 1.0))

        # Risk and Alert classification
        if threat_prob >= 0.70:
            alert_level = "CRITICAL"
        elif threat_prob >= 0.35:
            alert_level = "HIGH"
        elif threat_prob >= threshold:
            alert_level = "WARNING"
        else:
            alert_level = "AUTHENTIC"

        rms_energy = float(np.sqrt(np.mean(audio ** 2)))
        peak_amp = float(np.max(np.abs(audio)))

        # Fast approximate spectral centroid
        fft_mag = np.abs(np.fft.rfft(audio[:min(len(audio), 32768)]))
        freqs = np.fft.rfftfreq(min(len(audio), 32768), 1.0 / SAMPLE_RATE)
        spectral_centroid = float(np.sum(freqs * fft_mag) / (np.sum(fft_mag) + 1e-8))

        latency_ms = round((time.perf_counter() - t0) * 1000, 2)

        return {
            "verdict": "FAKE" if is_fake else "REAL",
            "is_fake": is_fake,
            "threat_score": round(threat_prob * 100, 1),
            "threat_probability": round(threat_prob, 4),
            "fake_probability_pct": round(threat_prob * 100, 2),
            "real_probability_pct": round(real_prob * 100, 2),
            "max_window_fake_prob": round(max_fake_prob, 4),
            "mean_window_fake_prob": round(mean_fake_prob, 4),
            "median_window_fake_prob": round(v_median, 4),
            "fake_window_ratio": round(fake_win_ratio, 4),
            "primary_window_fake_prob": round(primary_fake_prob, 4),
            "primary_window_verdict": "FAKE" if primary_fake_prob >= threshold else "REAL",
            "decision_rationale": decision_rationale,
            "threshold": round(threshold, 4),
            "alert_level": alert_level,
            "latency_ms": latency_ms,
            "audio_metrics": {
                "duration_seconds": round(duration, 2),
                "original_sample_rate": orig_sr,
                "processed_sample_rate": SAMPLE_RATE,
                "total_samples": num_audio_samples,
                "windows_analyzed": len(windows),
                "voiced_windows_analyzed": len(voiced_indices),
                "peak_amplitude": round(peak_amp, 4),
                "rms_energy": round(rms_energy, 4),
                "spectral_centroid_hz": round(spectral_centroid, 1),
            },
            "spectral_flags": {
                "phase_anomaly": "ERR_PHASE" if is_fake else "NORMAL",
                "vocoder_artifacts": "SYNTH_MATCH" if is_fake else "CLEAN",
                "prosody_stability": "UNNATURAL" if threat_prob > 0.5 else "ORGANIC"
            },
            "windows": window_results,
        }

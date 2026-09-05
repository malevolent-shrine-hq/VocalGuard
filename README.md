# VocalGuard 🛡️

**Forensic Real-Time Audio Deepfake & Voice Cloning Detection System**

*Trained & Evaluated on the Fake-or-Real (FoR / for-2sec) Forensic Speech Benchmark.*

VocalGuard is an enterprise-grade forensic audio analysis platform powered by a PyTorch **Multi-Resolution SE-ResNet (v3)** model. Designed to detect synthetic speech, neural voice cloning (TTS/VC), and vocoder artifacts with mathematical precision, it safeguards identity verification, VoIP communications, and financial authorizations against spoofing.

---

## 🔬 Forensic Neural Architecture

- **Multi-Resolution 3-Channel STFT Frontend:**
  - **Channel 0 (1024-Mel):** 128 mel filterbank bins (20–8,000 Hz) targeting vocal tract biology, formant transitions, and phoneme spectral envelope.
  - **Channel 1 (512-Linear):** High temporal resolution ($\Delta t \approx 16\text{ms}$) adaptively pooled to 128 bins to expose phase discontinuities, vocoder frame boundaries, and frame splicing clicks.
  - **Channel 2 (2048-Linear):** High spectral resolution ($\Delta f \approx 7.8\text{Hz}$) adaptively pooled to 128 bins capturing harmonic pitch overtones, comb-filter notches, and neural vocoder spectral tilt.
- **Asymmetric SE-ResNet Backbone:** Alternates $(5 \times 3)$ and $(3 \times 5)$ anisotropic convolutional kernels with Squeeze-and-Excitation channel attention ($r=16$) to correlate time-frequency artifacts.
- **Multi-Statistic Global Pooling:** Concatenates Temporal Mean, Temporal Standard Deviation, and Adaptive Max Pooling into a dense 768-D representation.
- **Calibrated Decision Boundary:** Binary Focal Loss ($\gamma=2.0, \alpha=0.5$) with optimal Youden's $J$ threshold calibrated at $\tau^* = 0.0509$.

---

## 📊 Benchmark Verification (Fake-or-Real Test Set)

*Evaluated on 1,088 unseen evaluation samples (544 Genuine Human / 544 Synthetic Deepfakes):*

| Metric | Score | Details |
| :--- | :--- | :--- |
| **Accuracy** | **93.66%** | 1,019 / 1,088 correctly classified |
| **ROC-AUC** | **98.71%** | Area under the Receiver Operating Characteristic curve |
| **EER** | **6.34%** | Equal Error Rate at equilibrium |
| **Deepfake Recall** | **93.57%** | 509 / 544 synthetic samples intercepted |
| **Real Voice Specificity** | **93.75%** | 510 / 544 authentic voices verified |
| **Model Footprint** | **12.86 MB** | PyTorch state dictionary checkpoint |

---

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide Icons, Canvas Waveform Visualizer
- **Inference Engine:** PyTorch, TorchAudio, NumPy, SciPy (Polyphase Resampling), SoundFile
- **API Backend:** FastAPI, Uvicorn, Python 3.12 (Hosted on Render)

---

## ⚡ Quick Start

### 1. Frontend
```bash
npm install
npm run dev
```

### 2. Backend (FastAPI + PyTorch)
```bash
cd api
uvicorn index:app --reload --port 8000
```

## 👥 Engineering Team

- **[Bimbok Mukherjee](https://github.com/Bimbok)** — PyTorch Model Architecture, DSP Pipeline & Backend Systems
- **[Aditya Paul](https://github.com/adityapaul26)** — PyTorch Model Optimization, DSP Pipeline & Backend Systems
- **[Bijan Murmu](https://github.com/bijanmurmu)** — Frontend Web Application & Cyber-Industrial UI/UX Systems

---
*Engineered for All India Council for Technical Education (Cyber Security Cell) - SIH Problem Statement 26104.*


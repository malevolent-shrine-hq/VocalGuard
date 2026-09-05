# Multi-stage Dockerfile for VocalGuard (FastAPI + Model + Production Uvicorn)
FROM python:3.12-slim

# Install ffmpeg and libsndfile for universal audio format decoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code and model weights
COPY api/ ./api/
COPY model/ ./model/

ENV HOST=0.0.0.0
ENV PORT=8000
ENV MODEL_PATH=/app/model/voice_deepfake_detector.pth

EXPOSE 8000

# Run FastAPI with uvicorn
CMD ["uvicorn", "api.index:app", "--host", "0.0.0.0", "--port", "8000"]

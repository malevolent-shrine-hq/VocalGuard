# -*- coding: utf-8 -*-
"""
VocalGuard FastAPI Backend
Endpoints for Voice Deepfake Detection with PyTorch v3 Model.
Compatible with Vercel Serverless, Docker, and local uvicorn.
"""

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Load environment variables from .env file if present
load_dotenv()

from api.detector import DetectorManager

app = FastAPI(
    title="VocalGuard API",
    description="Voice Deepfake Detection Engine Powered by PyTorch Multi-Domain Spectrogram CNN",
    version="1.0.0"
)

# Parse allowed CORS origins from environment variable
# Supports comma-separated URLs or wildcard "*"
raw_origins = os.environ.get("ALLOWED_ORIGINS", os.environ.get("FRONTEND_URL", "*")).strip()
if raw_origins == "*" or not raw_origins:
    origins = ["*"]
else:
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize detector singleton on startup
detector = DetectorManager.get_instance()


@app.get("/")
@app.get("/api")
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "VocalGuard Deepfake Detection Engine",
        "model_loaded": detector.model is not None,
        "device": str(detector.device),
        "threshold": detector.threshold,
        "checkpoint": Path(detector.checkpoint_path).name if detector.checkpoint_path else None,
        "allowed_origins": origins
    }


@app.post("/api/detect")
async def detect_audio(
    file: UploadFile = File(...),
    threshold: Optional[float] = Form(None)
):
    """
    Detect whether an uploaded audio file is a Real Human Voice or an AI Deepfake.
    Accepts: .wav, .mp3, .m4a, .aac, .flac, .ogg, .webm, .opus, and other common formats.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing audio file.")

    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        # Run inference
        result = detector.detect(
            audio_data=content,
            filename=file.filename,
            custom_threshold=threshold
        )

        result["file_name"] = file.filename
        result["file_size_bytes"] = len(content)

        return JSONResponse(status_code=200, content=result)

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Inference failed on file '{file.filename}': {str(e)}"
        )


@app.get("/api/samples")
def list_samples():
    """
    Provides demo audio samples for instant frontend testing.
    """
    sample_dir = Path(__file__).parent.parent / "samples"
    samples = []
    if sample_dir.exists():
        for f in sample_dir.glob("*.*"):
            if f.suffix.lower() in [".mp3", ".wav", ".m4a", ".ogg"]:
                samples.append({
                    "name": f.name,
                    "type": "synthetic" if "fake" in f.name.lower() or "voicemaker" in f.name.lower() else "human",
                    "path": f"/api/samples/{f.name}"
                })
    return {"samples": samples}


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("api.index:app", host=host, port=port, reload=True)

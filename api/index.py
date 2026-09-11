# -*- coding: utf-8 -*-
"""
VocalGuard FastAPI Backend
Endpoints for Voice Deepfake Detection with PyTorch v3 Model.
Compatible with Vercel Serverless, Docker, and local uvicorn.
"""

import os
import asyncio
import json
import logging
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

# Load environment variables from .env file if present
load_dotenv()

from api.detector import DetectorManager
from api.streaming_detector import SAMPLE_RATE, streaming_controller

logger = logging.getLogger("vocalguard.api")
MAX_STREAM_CHUNK_BYTES = int(os.getenv("STREAM_MAX_CHUNK_BYTES", str(256 * 1024)))
MAX_STREAM_SECONDS = float(os.getenv("STREAM_MAX_SECONDS", "3600"))
MAX_ACTIVE_STREAMS = int(os.getenv("STREAM_MAX_ACTIVE_SESSIONS", "16"))

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
        "allowed_origins": origins,
        "streaming_enabled": True,
        "streaming_active_sessions": streaming_controller.active_session_count,
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


@app.websocket("/ws/detect")
async def detect_live_audio(websocket: WebSocket):
    """Process one isolated 16 kHz mono PCM microphone stream in memory.

    Protocol: client sends a JSON `start` frame declaring `pcm_s16le`, then
    binary little-endian int16 mono PCM frames. Server frames are JSON status,
    prediction, and error messages. No microphone audio is written to disk.
    """
    if streaming_controller.active_session_count >= MAX_ACTIVE_STREAMS:
        await websocket.close(code=1013, reason="Live stream capacity reached")
        return

    await websocket.accept()
    session = streaming_controller.create_session()
    started = False
    logger.info("[STREAM:%s] WebSocket connected", session.session_id)
    try:
        await websocket.send_json({
            "type": "status",
            "session_id": session.session_id,
            "state": "LISTENING",
            "sample_rate": SAMPLE_RATE,
            "window_seconds": 2.0,
            "hop_seconds": 1.0,
            "message": "Connected. Send PCM 16-bit mono audio at 16 kHz.",
        })
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break

            text_payload = message.get("text")
            binary_payload = message.get("bytes")
            if text_payload is not None:
                try:
                    control = json.loads(text_payload)
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "error", "code": "MALFORMED_CONTROL", "message": "Control frames must be valid JSON."})
                    continue
                action = control.get("type") or control.get("action")
                if action == "start":
                    fmt = control.get("format", "pcm_s16le")
                    if fmt not in ["pcm_s16le", "pcm_f32le", "f32le"] and control.get("sample_rate", SAMPLE_RATE) != SAMPLE_RATE:
                        await websocket.send_json({"type": "error", "code": "UNSUPPORTED_FORMAT", "message": "Live detection requires 16 kHz PCM."})
                        continue
                    session.audio_format = fmt
                    started = True
                    await websocket.send_json({"type": "status", "session_id": session.session_id, "state": "BUFFERING", "buffered_seconds": 0.0, "target_seconds": 2.0})
                elif action == "stop":
                    await websocket.send_json({"type": "status", "session_id": session.session_id, "state": "STOPPED"})
                    break
                elif action == "ping":
                    await websocket.send_json({"type": "pong", "session_id": session.session_id})
                elif action == "reset":
                    session.reset()
                    await websocket.send_json({"type": "reset_complete", "session_id": session.session_id})
                elif action == "set_speaker":
                    speaker_id = control.get("speaker_id")
                    session.target_speaker_id = speaker_id
                    await websocket.send_json({
                        "type": "speaker_updated",
                        "session_id": session.session_id,
                        "target_speaker_id": speaker_id
                    })
                else:
                    await websocket.send_json({"type": "error", "code": "UNKNOWN_CONTROL", "message": f"Unsupported control action: {action}"})
                continue

            if binary_payload is None:
                continue
            started = True
            if not binary_payload or len(binary_payload) > MAX_STREAM_CHUNK_BYTES:
                await websocket.send_json({"type": "error", "code": "INVALID_AUDIO_CHUNK", "message": "Audio chunk exceeded size limit."})
                continue

            if session.audio_format in ["pcm_f32le", "f32le"]:
                if len(binary_payload) % 4 != 0:
                    continue
                pcm = np.frombuffer(binary_payload, dtype=np.float32)
            else:
                if len(binary_payload) % 2 != 0:
                    continue
                pcm = np.frombuffer(binary_payload, dtype="<i2").astype(np.float32) / 32768.0

            pcm = np.clip(pcm, -1.0, 1.0)
            if session.total_samples_received + len(pcm) > int(MAX_STREAM_SECONDS * SAMPLE_RATE):
                await websocket.send_json({"type": "error", "code": "SESSION_LIMIT", "message": "Maximum live session duration reached."})
                break
            # Inference is CPU/GPU-bound; move it off the websocket event loop.
            # Each connection awaits its result, so stale windows cannot queue up.
            response = await asyncio.to_thread(session.ingest_audio_chunk, pcm)
            if response:
                await websocket.send_json(response)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("[STREAM:%s] WebSocket stream failed", session.session_id)
        try:
            await websocket.send_json({"type": "error", "session_id": session.session_id, "code": "STREAM_FAILURE", "message": "Live analysis stopped because the server encountered an error."})
        except Exception:
            pass
    finally:
        streaming_controller.close_session(session.session_id)
        logger.info("[STREAM:%s] WebSocket disconnected", session.session_id)


@app.get("/api/samples")
def list_samples():
    """
    Provides demo audio samples for instant frontend testing.
    """
    sample_dir = Path(__file__).parent.parent / "public" / "samples"
    if not sample_dir.exists():
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


@app.get("/api/samples/{filename}")
def get_sample_file(filename: str):
    """
    Serves a specific demo audio sample file.
    """
    for base in [Path(__file__).parent.parent / "public" / "samples", Path(__file__).parent.parent / "samples"]:
        file_path = base / filename
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
# ============================================================
# SPEAKER BIOMETRICS & VOICEPRINT ENROLLMENT API
# ============================================================
@app.get("/api/biometrics/profiles")
def get_biometric_profiles():
    """Returns list of enrolled VIP/CXO voiceprint profiles."""
    from api.speaker_biometrics import biometrics_engine
    return {"profiles": biometrics_engine.list_profiles()}


@app.post("/api/biometrics/enroll")
async def enroll_biometric_profile(
    speaker_id: Optional[str] = Form(None),
    name: str = Form(...),
    role: str = Form("Executive"),
    authorized_limit: str = Form("₹ 50,00,000"),
    file: UploadFile = File(...)
):
    """Enrolls an executive's voice into the vault from an uploaded audio file or recording."""
    from api.speaker_biometrics import biometrics_engine
    from api.detector import load_audio_from_bytes_or_path
    import re
    if not speaker_id or not speaker_id.strip():
        clean_name = re.sub(r'[^a-zA-Z0-9]+', '_', name.lower()).strip('_')
        speaker_id = f"cxo_{clean_name}"
    audio_bytes = await file.read()
    audio, _, _ = load_audio_from_bytes_or_path(audio_bytes, file.filename)
    result = biometrics_engine.enroll_speaker(speaker_id, name, role, audio, authorized_limit)
    return result


@app.delete("/api/biometrics/profiles/{speaker_id}")
def delete_biometric_profile(speaker_id: str):
    """Deletes an enrolled voiceprint profile."""
    from api.speaker_biometrics import biometrics_engine
    success = biometrics_engine.delete_profile(speaker_id)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"status": "success", "message": f"Deleted profile {speaker_id}"}


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("api.index:app", host=host, port=port, reload=True)

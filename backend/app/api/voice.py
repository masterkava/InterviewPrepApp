"""Voice API — TTS, STT, and audio file management."""

import hashlib
import uuid
from pathlib import Path

import structlog
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from openai import AsyncOpenAI
from pydantic import BaseModel

from app.config import settings

logger = structlog.get_logger()
router = APIRouter(prefix="/voice", tags=["voice"])

AUDIO_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "audio"
TTS_CACHE_DIR = AUDIO_DIR / "tts_cache"

_openai_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        if not settings.openai_api_key:
            raise HTTPException(status_code=503, detail="OpenAI API key not configured")
        _openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _openai_client


class TTSRequest(BaseModel):
    text: str
    voice: str | None = None


class TTSResponse(BaseModel):
    audio_url: str
    cached: bool


class STTResponse(BaseModel):
    text: str


@router.post("/tts", response_model=TTSResponse)
async def text_to_speech(req: TTSRequest):
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    voice = req.voice or settings.tts_voice
    cache_key = hashlib.sha256(f"{req.text}:{voice}".encode()).hexdigest()[:16]
    cache_path = TTS_CACHE_DIR / f"{cache_key}.mp3"

    if cache_path.exists():
        return TTSResponse(
            audio_url=f"/api/v1/voice/audio/{cache_path.name}",
            cached=True,
        )

    client = _get_client()
    response = await client.audio.speech.create(
        model=settings.tts_model,
        voice=voice,
        input=req.text,
        response_format="mp3",
    )

    audio_bytes = response.read()
    cache_path.write_bytes(audio_bytes)

    logger.info("tts.generated", chars=len(req.text), voice=voice, file=cache_path.name)

    return TTSResponse(
        audio_url=f"/api/v1/voice/audio/{cache_path.name}",
        cached=False,
    )


@router.post("/stt", response_model=STTResponse)
async def speech_to_text(audio: UploadFile = File(...)):
    if not audio.content_type or not audio.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file")

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    ext = _ext_from_content_type(audio.content_type)
    temp_name = f"stt_{uuid.uuid4().hex[:12]}{ext}"
    temp_path = AUDIO_DIR / temp_name

    content = await audio.read()
    temp_path.write_bytes(content)

    try:
        client = _get_client()
        with open(temp_path, "rb") as f:
            transcript = await client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="text",
                language="en",
                prompt="This is a technical interview answer about software engineering, backend development, databases, APIs, and system design.",
            )

        logger.info("stt.transcribed", chars=len(transcript), file=temp_name)
        return STTResponse(text=transcript.strip())
    finally:
        temp_path.unlink(missing_ok=True)


@router.post("/upload")
async def upload_audio(audio: UploadFile = File(...)):
    if not audio.content_type or not audio.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file")

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    ext = _ext_from_content_type(audio.content_type)
    file_id = uuid.uuid4().hex[:16]
    filename = f"answer_{file_id}{ext}"
    file_path = AUDIO_DIR / filename

    content = await audio.read()
    file_path.write_bytes(content)

    logger.info("audio.uploaded", file=filename, size=len(content))

    return {
        "audio_url": f"/api/v1/voice/audio/{filename}",
        "filename": filename,
    }


@router.get("/audio/{filename}")
async def serve_audio(filename: str):
    file_path = AUDIO_DIR / filename
    tts_path = TTS_CACHE_DIR / filename

    if tts_path.exists():
        return FileResponse(tts_path, media_type="audio/mpeg")
    if file_path.exists():
        return FileResponse(file_path, media_type="audio/mpeg")

    raise HTTPException(status_code=404, detail="Audio file not found")


def _ext_from_content_type(content_type: str) -> str:
    mapping = {
        "audio/webm": ".webm",
        "audio/mpeg": ".mp3",
        "audio/mp4": ".m4a",
        "audio/wav": ".wav",
        "audio/ogg": ".ogg",
        "audio/x-m4a": ".m4a",
    }
    return mapping.get(content_type, ".webm")

"""WebSocket endpoint for live bot interview mode (queue-based)."""

import asyncio
import hashlib
import io
import json
import ssl
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
import jwt
import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.factory import get_llm_provider
from app.config import settings
from app.db.session import async_session_factory
from app.interview.answer_evaluator import AnswerEvaluator
from app.interview.engine import InterviewEngine
from app.models.interview import (
    Evaluation,
    InterviewAnswer,
    InterviewQuestion,
    InterviewSession,
)
from app.models.role import RoleSkill
from app.models.user import User

logger = structlog.get_logger()
router = APIRouter(prefix="/live", tags=["live"])

AUDIO_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "audio"
TTS_CACHE_DIR = AUDIO_DIR / "tts_cache"
AVG_CERT = Path(__file__).resolve().parent.parent.parent / "avg_root.pem"

_openai_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        http_client = None
        if AVG_CERT.exists():
            ctx = ssl.create_default_context(cafile=str(AVG_CERT))
            http_client = httpx.AsyncClient(verify=ctx)
        _openai_client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            http_client=http_client,
        )
    return _openai_client


async def _authenticate_ws(token: str) -> User | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.InvalidTokenError:
        return None
    if payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        if user and user.is_active:
            return user
    return None


async def _generate_tts(text: str) -> str:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    voice = settings.tts_voice
    cache_key = hashlib.sha256(f"{text}:{voice}".encode()).hexdigest()[:16]
    cache_path = TTS_CACHE_DIR / f"{cache_key}.mp3"
    if cache_path.exists():
        return f"/api/v1/voice/audio/{cache_path.name}"
    client = _get_client()
    response = await client.audio.speech.create(
        model=settings.tts_model, voice=voice, input=text, response_format="mp3",
    )
    audio_bytes = response.read()
    cache_path.write_bytes(audio_bytes)
    logger.info("live.tts.generated", chars=len(text), file=cache_path.name)
    return f"/api/v1/voice/audio/{cache_path.name}"


async def _transcribe_audio(audio_bytes: bytes) -> str:
    client = _get_client()
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "recording.webm"
    transcript = await client.audio.transcriptions.create(
        model="whisper-1", file=audio_file, response_format="text", language="en",
        prompt="This is a technical interview answer about software engineering.",
    )
    return transcript.strip()


async def _send_json(ws: WebSocket, data: dict) -> None:
    try:
        await ws.send_json(data)
    except Exception:
        pass


async def _find_seed_question(db: AsyncSession, role_id: uuid.UUID, question_text: str):
    from app.models.role import SeedQuestion
    result = await db.execute(
        select(SeedQuestion).where(
            SeedQuestion.role_id == role_id,
            SeedQuestion.question_text == question_text,
        ).limit(1)
    )
    return result.scalar_one_or_none()


@router.websocket("/{interview_id}")
async def live_interview(websocket: WebSocket, interview_id: str):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    user = await _authenticate_ws(token)
    if not user:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()
    logger.info("live.connected", interview_id=interview_id, user_id=str(user.id))

    try:
        async with async_session_factory() as db:
            iid = uuid.UUID(interview_id)
            provider = get_llm_provider()
            engine = InterviewEngine(provider, db)

            # Load interview
            from app.models.role import Role, Skill
            result = await db.execute(
                select(InterviewSession)
                .where(InterviewSession.id == iid, InterviewSession.user_id == user.id)
                .options(
                    selectinload(InterviewSession.role)
                    .selectinload(Role.role_skills)
                    .selectinload(RoleSkill.skill)
                )
            )
            interview = result.scalars().one_or_none()
            if not interview:
                await _send_json(websocket, {"type": "error", "message": "Interview not found"})
                await websocket.close(code=4002)
                return

            # Pre-load all questions or resume
            if interview.status == "configured":
                intro, all_questions = await engine.preload_all_questions(interview)
                await db.commit()
            elif interview.status == "in_progress":
                # Resume: get unanswered questions
                q_result = await db.execute(
                    select(InterviewQuestion)
                    .where(InterviewQuestion.session_id == iid)
                    .options(
                        selectinload(InterviewQuestion.skill),
                        selectinload(InterviewQuestion.answer),
                    )
                    .order_by(InterviewQuestion.sequence_number)
                )
                db_questions = list(q_result.scalars().unique().all())
                unanswered = [q for q in db_questions if q.answer is None]
                if not unanswered:
                    await _send_json(websocket, {"type": "error", "message": "All questions answered already."})
                    await websocket.close(code=4002)
                    return
                from app.interview.engine import QuestionResult
                intro = f"Welcome back! Let's continue your {interview.role.name} interview."
                all_questions = [
                    QuestionResult(
                        question_id=q.id,
                        sequence_number=q.sequence_number,
                        question_text=q.question_text,
                        difficulty=q.difficulty,
                        skill_slug=q.skill.slug if q.skill else "general",
                        question_type=q.question_type,
                    )
                    for q in unanswered
                ]
            else:
                await _send_json(websocket, {"type": "error", "message": "Interview already completed."})
                await websocket.close(code=4002)
                return

            total = len(all_questions)

            # Pre-generate TTS for all questions concurrently
            logger.info("live.preloading_tts", count=total)
            audio_urls = await asyncio.gather(
                *[_generate_tts(q.question_text) for q in all_questions]
            )
            logger.info("live.tts_preloaded", count=total)

            # Send full queue to frontend
            queue_data = []
            for q, audio_url in zip(all_questions, audio_urls):
                queue_data.append({
                    "id": str(q.question_id),
                    "sequence_number": q.sequence_number,
                    "question_text": q.question_text,
                    "difficulty": q.difficulty,
                    "skill": q.skill_slug,
                    "question_type": q.question_type,
                    "audio_url": audio_url,
                })

            await _send_json(websocket, {
                "type": "queue",
                "interviewer_message": intro,
                "questions": queue_data,
                "total": total,
            })

            # Background evaluation tracking
            answers_received = 0
            evals_completed = 0
            all_done = asyncio.Event()
            if total == 0:
                all_done.set()

            async def evaluate_in_background(question_id: uuid.UUID, question_text: str, answer_text: str):
                nonlocal evals_completed
                try:
                    async with async_session_factory() as eval_db:
                        # Load interview for role info
                        iv_result = await eval_db.execute(
                            select(InterviewSession)
                            .where(InterviewSession.id == iid)
                            .options(selectinload(InterviewSession.role))
                        )
                        iv = iv_result.scalars().one()

                        # Find reference answer from seed bank
                        seed_q = await _find_seed_question(eval_db, iv.role_id, question_text)
                        reference_answer = seed_q.reference_answer if seed_q else None
                        expected_concepts = seed_q.expected_concepts if seed_q else None

                        evaluator = AnswerEvaluator(provider)
                        eval_output = await evaluator.evaluate(
                            role_name=iv.role.name,
                            experience_level=iv.experience_level,
                            question_text=question_text,
                            answer_text=answer_text,
                            reference_answer=reference_answer,
                            expected_concepts=expected_concepts,
                        )

                        # Find the answer record and save evaluation
                        ans_result = await eval_db.execute(
                            select(InterviewAnswer).where(InterviewAnswer.question_id == question_id)
                        )
                        answer_obj = ans_result.scalars().one()

                        evaluation = Evaluation(
                            id=uuid.uuid4(),
                            answer_id=answer_obj.id,
                            technical_correctness=eval_output.technical_correctness,
                            conceptual_depth=eval_output.conceptual_depth,
                            communication_clarity=eval_output.communication_clarity,
                            relevance=eval_output.relevance,
                            problem_solving=eval_output.problem_solving,
                            completeness=eval_output.completeness,
                            overall_score=eval_output.overall_score,
                            concepts_identified=eval_output.concepts_identified,
                            concepts_missed=eval_output.concepts_missed,
                            feedback=eval_output.feedback,
                            strengths=eval_output.strengths,
                            weaknesses=eval_output.weaknesses,
                            follow_up_recommended=eval_output.follow_up_recommended,
                            follow_up_reason=eval_output.follow_up_reason,
                            prompt_version=settings.prompt_version,
                        )
                        eval_db.add(evaluation)
                        await eval_db.commit()

                        await _send_json(websocket, {
                            "type": "evaluation",
                            "question_id": str(question_id),
                            "overall_score": eval_output.overall_score,
                            "feedback": eval_output.feedback,
                            "strengths": eval_output.strengths,
                            "weaknesses": eval_output.weaknesses,
                        })
                        logger.info("live.eval.done", question_id=str(question_id), score=eval_output.overall_score)

                except Exception as e:
                    logger.error("live.eval.failed", question_id=str(question_id), error=str(e))
                    await _send_json(websocket, {
                        "type": "evaluation",
                        "question_id": str(question_id),
                        "overall_score": 5.0,
                        "feedback": "Evaluation could not be completed.",
                        "strengths": [],
                        "weaknesses": [],
                    })
                finally:
                    evals_completed += 1
                    if evals_completed >= total and answers_received >= total:
                        all_done.set()

            # Main loop: receive audio answers
            current_q_idx = 0

            while True:
                message = await websocket.receive()

                if message.get("type") == "websocket.disconnect":
                    break

                # Handle text messages
                if "text" in message:
                    try:
                        data = json.loads(message["text"])
                    except json.JSONDecodeError:
                        continue

                    if data.get("type") == "ping":
                        continue

                    if data.get("type") == "end":
                        interview.status = "completed"
                        interview.completed_at = datetime.now(timezone.utc)
                        await db.commit()
                        await _send_json(websocket, {
                            "type": "complete",
                            "message": "Interview ended early. Your report is ready.",
                        })
                        break
                    continue

                # Handle binary audio
                if "bytes" not in message:
                    continue

                audio_data = message["bytes"]
                if len(audio_data) < 100:
                    continue

                if current_q_idx >= total:
                    continue

                current_question = all_questions[current_q_idx]
                qid = current_question.question_id
                q_text = current_question.question_text

                # STT
                await _send_json(websocket, {"type": "processing", "question_id": str(qid)})

                try:
                    transcript = await _transcribe_audio(audio_data)
                except Exception as e:
                    logger.error("live.stt.failed", error=str(e))
                    await _send_json(websocket, {"type": "error", "message": "Failed to transcribe audio."})
                    continue

                if not transcript or len(transcript.strip()) < 2:
                    await _send_json(websocket, {"type": "error", "message": "Could not detect speech."})
                    continue

                # Send transcript back immediately
                await _send_json(websocket, {
                    "type": "transcript",
                    "question_id": str(qid),
                    "text": transcript,
                })

                # Save answer to DB
                answer = InterviewAnswer(
                    id=uuid.uuid4(),
                    question_id=qid,
                    answer_text=transcript,
                )
                db.add(answer)
                await db.flush()
                await db.commit()

                answers_received += 1
                current_q_idx += 1

                # Start background evaluation
                asyncio.create_task(evaluate_in_background(qid, q_text, transcript))

                # Tell frontend to advance
                if current_q_idx < total:
                    await _send_json(websocket, {"type": "next"})
                else:
                    # All questions answered — wait for evaluations
                    await _send_json(websocket, {"type": "finalizing"})
                    try:
                        await asyncio.wait_for(all_done.wait(), timeout=180)
                    except asyncio.TimeoutError:
                        logger.warning("live.eval_timeout", pending=total - evals_completed)

                    # Mark interview complete
                    await db.refresh(interview)
                    interview.status = "completed"
                    interview.completed_at = datetime.now(timezone.utc)
                    await db.commit()

                    await _send_json(websocket, {
                        "type": "complete",
                        "message": "Interview complete! Your detailed report is ready.",
                    })
                    break

    except WebSocketDisconnect:
        logger.info("live.disconnected", interview_id=interview_id)
    except Exception as e:
        logger.error("live.error", interview_id=interview_id, error=str(e))
        try:
            await _send_json(websocket, {"type": "error", "message": "Internal server error"})
            await websocket.close(code=1011)
        except Exception:
            pass

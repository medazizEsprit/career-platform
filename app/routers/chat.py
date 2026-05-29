"""Chat router — POST /api/chat streams SSE tokens"""
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Optional

from app.models.llm import stream_chat
from app.state import state

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict]] = []


def _event_stream(message: str, history: list):
    """Generator that yields SSE-formatted chunks."""
    try:
        for chunk in stream_chat(
            message=message,
            history=history,
            cv_text=state.cv_text,
            top_matches=state.top_matches,
        ):
            payload = json.dumps({"token": chunk})
            yield f"data: {payload}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    finally:
        yield "data: [DONE]\n\n"


@router.post("/chat")
async def chat_endpoint(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    return StreamingResponse(
        _event_stream(req.message, req.history or []),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

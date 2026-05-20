from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import AsyncIterator

from axis.inference.hardware_detect import get_capability_score
from axis.inference.ollama_client import stream_chat as ollama_stream
from axis.inference.cloud_client import stream_chat as cloud_stream
from axis.core.config import settings

router = APIRouter(tags=["inference"])


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: str | None = None
    stream: bool = True
    use_rag: bool = False


class ChatResponse(BaseModel):
    content: str
    provider: str  # "local" | "openai" | "groq" | "anthropic" | "openrouter"
    model: str


def _should_use_local() -> bool:
    """Decide inference backend based on config + hardware score."""
    if settings.inference_mode == "local":
        return True
    if settings.inference_mode == "cloud":
        return False
    # auto: use local if hardware score > threshold
    score = get_capability_score()
    return score >= 2  # 0=CPU-only, 1=iGPU, 2=dGPU/NPU, 3=high-end


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    messages = [m.model_dump() for m in req.messages]

    if req.use_rag:
        from axis.rag.pipeline import augment_with_rag
        messages = await augment_with_rag(messages)

    if _should_use_local():
        try:
            model = req.model or settings.ollama_default_model
            content = await _collect_stream(ollama_stream(messages, model=model))
            return ChatResponse(content=content, provider="local", model=model)
        except Exception as e:
            # Fallback to cloud on local failure
            if settings.inference_mode == "local":
                raise HTTPException(status_code=503, detail=f"Local inference failed: {e}")

    # Cloud fallback
    content, provider, model = await cloud_stream(messages, req.model)
    return ChatResponse(content=content, provider=provider, model=model)


async def _collect_stream(gen: AsyncIterator[str]) -> str:
    parts = []
    async for chunk in gen:
        parts.append(chunk)
    return "".join(parts)

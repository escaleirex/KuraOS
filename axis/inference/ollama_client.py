from typing import AsyncIterator
import httpx
import json

from axis.core.config import settings


async def stream_chat(messages: list[dict], model: str | None = None) -> AsyncIterator[str]:
    """Stream a chat completion from Ollama."""
    model = model or settings.ollama_default_model
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
    }
    async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=120) as client:
        async with client.stream("POST", "/api/chat", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line:
                    continue
                data = json.loads(line)
                if content := data.get("message", {}).get("content"):
                    yield content
                if data.get("done"):
                    break


async def list_models() -> list[str]:
    async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=10) as client:
        resp = await client.get("/api/tags")
        resp.raise_for_status()
        return [m["name"] for m in resp.json().get("models", [])]


async def pull_model(model: str) -> AsyncIterator[dict]:
    """Pull a model, yielding progress dicts."""
    async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=600) as client:
        async with client.stream("POST", "/api/pull", json={"name": model}) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line:
                    yield json.loads(line)

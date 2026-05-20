"""Cloud API fallback client.

Priority order: groq → openai → anthropic → openrouter
Only providers with a configured API key are used.
"""
from typing import AsyncIterator
import httpx

from axis.core.config import settings

# Default models per provider
_DEFAULTS = {
    "groq": "llama-3.1-70b-versatile",
    "openai": "gpt-4o-mini",
    "anthropic": "claude-haiku-4-5-20251001",
    "openrouter": "meta-llama/llama-3.1-70b-instruct:free",
}

_PRIORITY = ["groq", "openai", "anthropic", "openrouter"]


def _available_providers() -> list[str]:
    keys = {
        "groq": settings.groq_api_key,
        "openai": settings.openai_api_key,
        "anthropic": settings.anthropic_api_key,
        "openrouter": settings.openrouter_api_key,
    }
    preferred = settings.cloud_preferred_provider
    ordered = [preferred] + [p for p in _PRIORITY if p != preferred]
    return [p for p in ordered if keys[p]]


async def stream_chat(
    messages: list[dict],
    model: str | None = None,
) -> tuple[str, str, str]:
    """Returns (content, provider, model)."""
    providers = _available_providers()
    if not providers:
        raise RuntimeError("No cloud API keys configured")

    for provider in providers:
        try:
            content = await _call(provider, messages, model)
            used_model = model or _DEFAULTS[provider]
            return content, provider, used_model
        except Exception:
            continue

    raise RuntimeError("All cloud providers failed")


async def _call(provider: str, messages: list[dict], model: str | None) -> str:
    model = model or _DEFAULTS[provider]
    if provider == "groq":
        return await _openai_compat(
            "https://api.groq.com/openai/v1/chat/completions",
            settings.groq_api_key,
            model,
            messages,
        )
    if provider == "openai":
        return await _openai_compat(
            "https://api.openai.com/v1/chat/completions",
            settings.openai_api_key,
            model,
            messages,
        )
    if provider == "openrouter":
        return await _openai_compat(
            "https://openrouter.ai/api/v1/chat/completions",
            settings.openrouter_api_key,
            model,
            messages,
        )
    if provider == "anthropic":
        return await _anthropic(model, messages)
    raise ValueError(f"Unknown provider: {provider}")


async def _openai_compat(url: str, api_key: str, model: str, messages: list[dict]) -> str:
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {"model": model, "messages": messages}
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def _anthropic(model: str, messages: list[dict]) -> str:
    system = ""
    filtered = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        else:
            filtered.append(m)

    headers = {
        "x-api-key": settings.anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": model,
        "max_tokens": 4096,
        "messages": filtered,
    }
    if system:
        payload["system"] = system

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()["content"][0]["text"]

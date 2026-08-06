"""Provider-neutral LLM client. Supports Gemini and DeepSeek/OpenAI with completion & streaming."""
import json
import re
from typing import Any, AsyncGenerator
import httpx
from app.core.config import get_settings

class LLMError(Exception): pass
class LLMNotConfiguredError(LLMError): pass

_DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"

def _parse_json(content: str) -> dict[str, Any]:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        cleaned = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:]).strip()
    try:
        parsed = json.loads(cleaned)
    except ValueError:
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if not match: raise
        parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict): raise LLMError("LLM returned a non-object response")
    return parsed

async def _call_gemini(messages: list[dict[str, str]], api_key: str, model: str, temperature: float, json_mode: bool) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    contents = []
    system_instruction = None
    for m in messages:
        if m["role"] == "system":
            system_instruction = {"parts": [{"text": m["content"]}]}
        else:
            role = "user" if m["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": m["content"]}]})
    
    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {"temperature": temperature, "maxOutputTokens": 1024}
    }
    if json_mode:
        payload["generationConfig"]["responseMimeType"] = "application/json"
    if system_instruction:
        payload["systemInstruction"] = system_instruction
        
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(url, json=payload)
        res.raise_for_status()
        data = res.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            raise LLMError("Invalid Gemini response format")

async def _stream_gemini(messages: list[dict[str, str]], api_key: str, model: str, temperature: float) -> AsyncGenerator[str, None]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={api_key}"
    contents = []
    system_instruction = None
    for m in messages:
        if m["role"] == "system":
            system_instruction = {"parts": [{"text": m["content"]}]}
        else:
            role = "user" if m["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": m["content"]}]})
    
    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {"temperature": temperature, "maxOutputTokens": 1024}
    }
    if system_instruction:
        payload["systemInstruction"] = system_instruction
        
    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream("POST", url, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    raw = line[6:].strip()
                    if not raw: continue
                    try:
                        chunk_data = json.loads(raw)
                        text = chunk_data["candidates"][0]["content"]["parts"][0]["text"]
                        if text:
                            yield text
                    except Exception:
                        pass

async def _call_deepseek(messages: list[dict[str, str]], api_key: str, model: str, temperature: float, json_mode: bool) -> str:
    payload: dict[str, Any] = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": 1024, "stream": False}
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
        payload["max_tokens"] = 600
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(_DEEPSEEK_URL, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload)
        response.raise_for_status()
        body = response.json()
        return body["choices"][0]["message"]["content"]

async def _stream_deepseek(messages: list[dict[str, str]], api_key: str, model: str, temperature: float) -> AsyncGenerator[str, None]:
    payload: dict[str, Any] = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": 1024, "stream": True}
    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream("POST", _DEEPSEEK_URL, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    raw = line[6:].strip()
                    if raw == "[DONE]": break
                    if not raw: continue
                    try:
                        chunk_data = json.loads(raw)
                        delta = chunk_data["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield delta
                    except Exception:
                        pass

async def _call(messages: list[dict[str, str]], temperature: float, json_mode: bool) -> str:
    settings = get_settings()
    api_key = settings.active_llm_key
    if not api_key:
        raise LLMNotConfiguredError("No LLM API key configured (gemini_api_key or deepseek_api_key)")
    provider = settings.llm_provider.lower()
    if provider == "deepseek" or (settings.deepseek_api_key and not settings.gemini_api_key):
        return await _call_deepseek(messages, settings.deepseek_api_key or api_key, settings.deepseek_model, temperature, json_mode)
    else:
        model = settings.gemini_model or "gemini-2.5-flash"
        return await _call_gemini(messages, settings.gemini_api_key or api_key, model, temperature, json_mode)

async def complete_json(messages: list[dict[str, str]], temperature: float = 0.7) -> dict[str, Any]:
    try:
        return _parse_json(await _call(messages, temperature, True))
    except (ValueError, json.JSONDecodeError) as exc:
        raise LLMError(f"Could not parse LLM JSON: {exc}") from exc

async def complete_text(messages: list[dict[str, str]], temperature: float = 0.8) -> str:
    return await _call(messages, temperature, False)

async def stream_text(messages: list[dict[str, str]], temperature: float = 0.8) -> AsyncGenerator[str, None]:
    settings = get_settings()
    api_key = settings.active_llm_key
    if not api_key:
        raise LLMNotConfiguredError("No LLM API key configured")
    provider = settings.llm_provider.lower()
    if provider == "deepseek" or (settings.deepseek_api_key and not settings.gemini_api_key):
        async for chunk in _stream_deepseek(messages, settings.deepseek_api_key or api_key, settings.deepseek_model, temperature):
            yield chunk
    else:
        model = settings.gemini_model or "gemini-2.5-flash"
        async for chunk in _stream_gemini(messages, settings.gemini_api_key or api_key, model, temperature):
            yield chunk
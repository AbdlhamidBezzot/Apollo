"""CineBot service ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â LLM-first conversational assistant (spec ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§2.1).

Every user message goes to the LLM with the full conversation so far plus a
profile summary. The model returns a natural reply AND a `ready_to_suggest`
flag. Only when that flag is true does the backend:

  1. fetch a real TMDB candidate pool (discover + profile re-ranking),
  2. make a SECOND, grounded LLM call with those candidates attached so the
     bot can only talk about titles that actually exist in the pool.

This is what makes a suggestion traceable to real data instead of an invented
title. If no LLM key is configured, the service degrades to the Phase-1
keyword parser so the app still works without one.
"""

from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy.orm import Session

from app.models import ChatMessage, ChatSession, Preferences, Rating, WatchHistory
from app.schemas import SuggestedTitle
from app.services import llm, recommendations
from app.services.tmdb import TMDbError, tmdb

MOOD_GENRES: dict[str, list[int]] = {
    "cozy": [35, 10749, 10751, 16],
    "mind-bending": [53, 878, 9648],
    "feel-good": [35, 10749, 10751, 16],
    "scary": [27, 53, 9648],
    "action-packed": [28, 12, 80],
    "light": [35, 10751, 10749, 16],
    "funny": [35],
    "chill": [10751, 36, 99],
    "sad": [18, 10749],
    "exciting": [28, 12, 878, 53],
}

GENRE_NAME_IDS: dict[str, int] = {
    "action": 28,
    "adventure": 12,
    "animation": 16,
    "comedy": 35,
    "crime": 80,
    "documentary": 99,
    "drama": 18,
    "family": 10751,
    "fantasy": 14,
    "history": 36,
    "horror": 27,
    "music": 10402,
    "mystery": 9648,
    "romance": 10749,
    "sci-fi": 878,
    "science fiction": 878,
    "thriller": 53,
    "war": 10752,
    "western": 37,
    "rom-com": 10749,
}

_ID_TO_NAME = {v: k.title() for k, v in GENRE_NAME_IDS.items()}

_GENERAL_SYSTEM_PROMPT = (
    "You are Gemini, a helpful, knowledgeable, and friendly AI assistant built into Apollo, "
    "a movie streaming platform. When the user asks about movies, TV shows, or wants recommendations, "
    "you help them find what to watch. For everything else â€” questions about the world, coding, "
    "writing, math, advice, general chat â€” you answer helpfully as a general-purpose AI assistant.\n"
    "\n"
    "Be natural, engaging, and genuinely helpful. Do NOT restrict yourself to movie topics only. "
    "Respond conversationally and directly to whatever the user says."
)

_SYSTEM_PROMPT = (
    "You are CineBot, Apollo's warm, human movie-night companion. You help a user plan what to watch.\n"
    "\n"
    "You have the full conversation and a summary of the user's profile. React like an attentive, "
    "engaging person:\n"
    "- Acknowledge what was actually said.\n"
    "- Ask at most ONE natural follow-up when you need more signal (mood, who is watching, how much "
    "time). Never fire an interrogation-style list of questions.\n"
    "- Stay in your lane: light empathy and mood-appropriate movie chat. If the user signals real "
    "distress rather than a passing mood, gently acknowledge it and keep it caring and simple - you "
    "are a movie companion, not a counselor. Do not attempt to 'handle' it as a support service.\n"
    "\n"
    "## Grounding rule (critical)\n"
    "You are only allowed to NAME a specific movie/series title when real candidates are supplied to "
    "you in this same call. In this first call you are given NO candidates, so you must NOT name any "
    "real title. You can talk generically about genres/moods, but never invent a title.\n"
    "\n"
    "## Output contract\n"
    "Always respond with a single JSON object with EXACTLY these keys:\n"
    '{"reply": "your conversational reply, shown verbatim to the user",\n'
    ' "ready_to_suggest": true|false,\n'
    ' "preferences": {"genres": ["comedy"], "excluded_genres": ["horror"],\n'
    '   "max_runtime_minutes": 120, "mood": "funny"}}\n'
    "\n"
    "- ready_to_suggest must be TRUE only when you have enough signal from the conversation/profile "
    "to confidently pick a real title (the user expressed a mood, genre, time budget, or asked for a "
    "recommendation). For a bare greeting, small talk, a mood/life statement without a watch request, "
    "or general chit-chat, keep it FALSE.\n"
    "- preferences.genres / excluded_genres: use lowercase English genre names from this list only: "
    "action, adventure, animation, comedy, crime, documentary, drama, family, fantasy, history, "
    "horror, music, mystery, romance, sci-fi, thriller, war, western. Empty list if unknown.\n"
    "- preferences.mood: a broad word the user used (e.g. 'funny', 'cozy', 'scary', 'action-packed', "
    "'feel-good', 'light'). \"null\" if none.\n"
    "- preferences.max_runtime_minutes: a number if the user implied a time budget, else null.\n"
)

_PITCH_SYSTEM_PROMPT = (
    "You are CineBot's grounded picker.\n"
    "\n"
    "You are preparing the final, grounded pick for a user. A backend has already built a short, "
    "REAL list of candidate titles (each with real TMDB metadata: id, title, year, genres, runtime, "
    "rating, overview).\n"
    "\n"
    "Rules:\n"
    "- You may recommend ONLY titles from this candidate list. NEVER invent or name any other title.\n"
    "- Write a natural reply that talks about the SPECIFIC candidates: mention their real genres, "
    "runtime, and why each fits the user's stated mood/constraints. Do not reuse a generic pitch.\n"
    "- Recommend up to 3 of the candidates, each with a genuine one-line hook based on that title's "
    "real data.\n"
    "\n"
    "Return JSON:\n"
    '{"reply": "your conversational pitch message",\n'
    ' "suggested_titles": [{"tmdb_id": <int>, "media_type": "movie", "pitch": "one-line hook"}]}\n'
    "suggested_titles.tmdb_id values must be among the candidate ids provided."
)


# --------------------------------------------------------------------------- #
# Context builders
# --------------------------------------------------------------------------- #


def _profile_summary(db: Session, profile_id: int) -> str:
    """Human-readable profile summary for the LLM (prefs, ratings, history)."""
    prefs = db.query(Preferences).filter(Preferences.profile_id == profile_id).one_or_none()
    parts: list[str] = []

    fav = [f"#{gid}" for gid in (prefs.favorite_genres or []) if prefs] if prefs else []
    excl = [f"#{gid}" for gid in (prefs.excluded_genres or []) if prefs] if prefs else []
    if fav:
        parts.append("favorite genres: " + ", ".join(fav))
    if excl:
        parts.append("excluded genres: " + ", ".join(excl))

    rated = db.query(Rating).filter(Rating.profile_id == profile_id).all()
    liked = [r for r in rated if r.rating >= 4] if rated else []
    if liked and rated:
        parts.append(f"likes {len(liked)}/{len(rated)} titles they rated")
    if rated:
        parts.append(f"has rated {len(rated)} titles")

    history_count = (
        db.query(WatchHistory).filter(WatchHistory.profile_id == profile_id).count()
    )
    if history_count:
        parts.append(f"has a watch history of {history_count} titles")
    return "; ".join(parts) if parts else "fresh profile, no preferences recorded yet"


def _load_history(db: Session, session_id: int) -> list[dict[str, str]]:
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.id)
        .all()
    )
    return [{"role": m.role, "content": m.content} for m in rows if m.role in ("user", "assistant")]


def _get_previously_suggested_ids(db: Session, session_id: int) -> set[int]:
    rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .all()
    )
    suggested: set[int] = set()
    for row in rows:
        if row.suggested_titles and isinstance(row.suggested_titles, list):
            for item in row.suggested_titles:
                if isinstance(item, dict) and item.get("tmdb_id"):
                    try:
                        suggested.add(int(item["tmdb_id"]))
                    except (ValueError, TypeError):
                        pass
    return suggested


# --------------------------------------------------------------------------- #
# LLM helpers
# --------------------------------------------------------------------------- #


async def _llm_call(messages: list[dict[str, str]], temperature: float = 0.7) -> dict[str, Any]:
    return await llm.complete_json(messages, temperature=temperature)


async def _classify_and_reply(
    db: Session, profile_id: int, messages: list[dict[str, str]]
) -> dict[str, Any]:
    """Call 1: conversational reply + structured decide flag + extracted prefs."""
    profile = _profile_summary(db, profile_id)
    system = f"{_SYSTEM_PROMPT}\n\nUser profile summary:\n{profile}"
    payload = await _llm_call([{"role": "system", "content": system}, *messages])
    return {
        "reply": str(payload.get("reply") or ""),
        "ready_to_suggest": bool(payload.get("ready_to_suggest") or False),
        "preferences": payload.get("preferences") or {},
        "suggested_titles": [],
    }


def _parse_preferences(prefs: dict[str, Any]) -> dict[str, Any]:
    """Turn LLM-extracted preference names into concrete TMDB filter configs."""
    genres: list[int] = []
    excluded: list[int] = []
    for name in prefs.get("genres") or []:
        gid = GENRE_NAME_IDS.get(str(name).strip().lower())
        if gid:
            genres.append(gid)
    for name in prefs.get("excluded_genres") or []:
        gid = GENRE_NAME_IDS.get(str(name).strip().lower())
        if gid:
            excluded.append(gid)
    mood = prefs.get("mood")
    if isinstance(mood, str) and mood:
        genres.extend(MOOD_GENRES.get(mood.strip().lower(), []))

    runtime = prefs.get("max_runtime_minutes")
    runtime = int(runtime) if isinstance(runtime, (int, float)) and runtime else None
    return {"genres": list(dict.fromkeys(genres)), "excluded": excluded, "runtime": runtime}


async def _candidate_pool(
    db: Session, profile_id: int, prefs: dict[str, Any], session_id: int | None = None
) -> list[dict[str, Any]]:
    """Real TMDB discover pool filtered by extracted prefs + profile re-ranked."""
    # Keep constraints from the whole conversation even when the latest LLM
    # extraction is incomplete, so follow-up messages do not reset the pick.
    conversation = " ".join(m["content"] for m in _load_history(db, session_id) if m["role"] == "user") if session_id else ""
    config = _parse_preferences(prefs)
    config["genres"] = list(dict.fromkeys([*config["genres"], *_find_genres(conversation)]))
    config["excluded"] = list(dict.fromkeys([*config["excluded"], *_find_exclusions(conversation)]))
    config["runtime"] = config["runtime"] or _find_runtime_max(conversation)
    candidates = await recommendations.movie_night_candidates(
        db,
        profile_id,
        genres=config["genres"] or None,
        max_runtime=config["runtime"],
        min_rating=6.0,
        limit=20,
    )
    if config["excluded"]:
        candidates = [
            c for c in candidates if not (set(c.get("genre_ids") or []) & set(config["excluded"]))
        ]
    if session_id is not None:
        seen = _get_previously_suggested_ids(db, session_id)
        candidates = [c for c in candidates if c.get("id") not in seen]
    return candidates[:5]


async def _grounded_pitch(
    db: Session,
    profile_id: int,
    candidates: list[dict[str, Any]],
    history: list[dict[str, str]],
) -> dict[str, Any]:
    """Call 2: grounded LLM call that can only talk about the real candidates."""
    candidate_block = json.dumps(candidates, ensure_ascii=False)
    system = f"{_PITCH_SYSTEM_PROMPT}\n\nCANDIDATES:\n{candidate_block}"
    profile_text = _profile_summary(db, profile_id)
    user = (
        "The user is ready for a pick. Here is the conversation so far.\n"
        + "Profile summary: " + profile_text + "\n\n"
        + "\n".join(f"{m['role']}: {m['content']}" for m in history[-6:])
    )
    result = await _llm_call(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.6,
    )
    return result


def _suggested_from_result(result: dict[str, Any], candidates: list[dict[str, Any]]) -> list[SuggestedTitle]:
    allowed = {c["id"] for c in candidates}
    out: list[SuggestedTitle] = []
    meta = {c["id"]: c for c in candidates}
    for item in (result.get("suggested_titles") or []):
        if not isinstance(item, dict):
            continue
        tmdb_id = item.get("tmdb_id")
        if tmdb_id not in allowed:
            continue
        title = (item.get("title")) or meta[tmdb_id].get("title") or meta[tmdb_id].get("name") or "Untitled"
        pitch = item.get("pitch") or _title_pitch(meta[tmdb_id])
        out.append(
            SuggestedTitle(
                tmdb_id=tmdb_id,
                media_type=item.get("media_type") or "movie",
                title=title,
                pitch=pitch,
            )
        )
    if not out and candidates:
        for c in candidates[:3]:
            out.append(
                SuggestedTitle(
                    tmdb_id=c["id"],
                    media_type=c.get("media_type") or "movie",
                    title=c.get("title") or c.get("name") or "Untitled",
                    pitch=_title_pitch(c),
                )
            )
    return out


def _title_pitch(item: dict[str, Any]) -> str:
    overview = (item.get("overview") or "").strip()
    hook = (overview.split(".")[0] + ".") if overview else "a crowd-pleaser"
    return hook


async def handle_message(
    db: Session, profile_id: int, message: str, session_id: int | None = None
) -> dict[str, Any]:
    """Gemini-powered conversation with a two-track path:
    - General messages â†’ free-form Gemini text (no JSON constraint)
    - Movie recommendation requests â†’ structured JSON path with TMDB grounding
    """
    from app.core.config import get_settings

    session_id = _ensure_session(db, profile_id, session_id)
    db.add(ChatMessage(session_id=session_id, role="user", content=message))
    db.commit()

    has_llm = bool(get_settings().active_llm_key and get_settings().active_llm_key.strip())

    if not has_llm:
        # No LLM key: simple rule-based small-talk or movie suggestions.
        smalltalk = _rule_smalltalk(message)
        if smalltalk is not None and not _has_recommendation_intent(message):
            _persist_assistant(db, session_id, smalltalk, [])
            return _response(smalltalk, [], session_id)
        return await _rule_based_handle(db, profile_id, message, session_id)

    history = _load_history(db, session_id)
    has_intent = _has_recommendation_intent(
        " ".join(m["content"] for m in history if m["role"] == "user")
    )

    # --- Movie recommendation path: uses structured JSON + TMDB grounding ---
    if has_intent:
        try:
            first = await _classify_and_reply(db, profile_id, history)
            candidates = await _candidate_pool(
                db, profile_id, first.get("preferences") or {}, session_id=session_id
            )
            if candidates:
                pitched = await _grounded_pitch(db, profile_id, candidates, history)
                titles = _suggested_from_result(pitched, candidates)
                reply = str(pitched.get("reply") or first.get("reply") or "Here are a few titles that fit:")
                _persist_assistant(db, session_id, reply, [t.model_dump() for t in titles])
                return _response(reply, [t.model_dump() for t in titles], session_id)
            # No candidates found, fall through to general reply
            reply = first.get("reply") or "I couldn't find any titles matching that — try changing the genre or mood."
            _persist_assistant(db, session_id, reply, [])
            return _response(reply, [], session_id)
        except TMDbError:
            raise
        except Exception as exc:
            import logging
            logging.exception(f"Gemini movie-path error: {exc}")
            # On failure, fall through to the general conversation path below.

    # --- General conversation path: free-form Gemini response (no JSON) ---
    try:
        system = _GENERAL_SYSTEM_PROMPT
        profile = _profile_summary(db, profile_id)
        if profile and profile != "fresh profile, no preferences recorded yet":
            system += f"\n\nUser profile: {profile}"
        messages = [{"role": "system", "content": system}, *history]
        reply = await llm.complete_text(messages, temperature=0.8)
        _persist_assistant(db, session_id, reply, [])
        return _response(reply, [], session_id)
    except TMDbError:
        raise
    except Exception as exc:
        import logging
        logging.exception(f"Gemini general-path error: {exc}")
        error_reply = "CineBot is temporarily unavailable. Please try again shortly."
        _persist_assistant(db, session_id, error_reply, [])
        return _response(error_reply, [], session_id)


async def handle_message_stream(
    db: Session, profile_id: int, message: str, session_id: int | None = None
):
    """Real-time SSE stream generator for CineBot responses."""
    import asyncio
    from app.core.config import get_settings
    from app.services.llm import LLMNotConfiguredError

    session_id = _ensure_session(db, profile_id, session_id)
    db.add(ChatMessage(session_id=session_id, role="user", content=message))
    db.commit()

    yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

    has_llm = bool(get_settings().active_llm_key and get_settings().active_llm_key.strip())

    if not has_llm:
        res = await _rule_based_handle(db, profile_id, message, session_id)
        reply = res["reply"]
        titles = res.get("suggested_titles") or []
        for word in reply.split(" "):
            yield f"data: {json.dumps({'type': 'token', 'token': word + ' '})}\n\n"
            await asyncio.sleep(0.02)
        if titles:
            yield f"data: {json.dumps({'type': 'suggestions', 'suggested_titles': titles})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return

    history = _load_history(db, session_id)
    has_intent = _has_recommendation_intent(" ".join(m["content"] for m in history if m["role"] == "user"))

    if has_intent:
        res = await handle_message(db, profile_id, message, session_id)
        reply = res["reply"]
        titles = res.get("suggested_titles") or []
        for word in reply.split(" "):
            yield f"data: {json.dumps({'type': 'token', 'token': word + ' '})}\n\n"
            await asyncio.sleep(0.02)
        if titles:
            yield f"data: {json.dumps({'type': 'suggestions', 'suggested_titles': titles})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return

    # Stream free-form Gemini/DeepSeek conversation
    full_reply = ""
    try:
        system = _GENERAL_SYSTEM_PROMPT
        profile = _profile_summary(db, profile_id)
        if profile and profile != "fresh profile, no preferences recorded yet":
            system += f"\n\nUser profile: {profile}"
        messages = [{"role": "system", "content": system}, *history]

        async for chunk in llm.stream_text(messages, temperature=0.8):
            full_reply += chunk
            yield f"data: {json.dumps({'type': 'token', 'token': chunk})}\n\n"

        _persist_assistant(db, session_id, full_reply, [])
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    except LLMNotConfiguredError:
        fallback = "CineBot needs an LLM API key to work. Please add GEMINI_API_KEY or DEEPSEEK_API_KEY to your backend .env file."
        _persist_assistant(db, session_id, fallback, [])
        yield f"data: {json.dumps({'type': 'token', 'token': fallback})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    except Exception as exc:
        import logging
        logging.exception(f"Gemini stream error: {exc}")
        if not full_reply:
            fallback = "CineBot is temporarily unavailable. Please try again shortly."
            _persist_assistant(db, session_id, fallback, [])
            for word in fallback.split(" "):
                yield f"data: {json.dumps({'type': 'token', 'token': word + ' '})}\n\n"
                await asyncio.sleep(0.02)
        yield f"data: {json.dumps({'type': 'done'})}\n\n"


def _ensure_session(db: Session, profile_id: int, session_id: int | None) -> int:
    if session_id is not None:
        session = db.get(ChatSession, session_id)
        if session is not None and session.profile_id == profile_id:
            return session.id
    session = ChatSession(profile_id=profile_id)
    db.add(session)
    db.flush()
    return session.id


def _persist_assistant(db: Session, session_id: int, content: str, titles: list[dict[str, Any]] | None) -> None:
    db.add(ChatMessage(session_id=session_id, role="assistant", content=content, suggested_titles=titles))
    db.commit()


def _response(reply: str, titles: list[dict[str, Any]] | None, session_id: int | None) -> dict[str, Any]:
    return {
        "reply": reply,
        "suggested_titles": titles or [],
        "session_id": session_id,
        "action": "none",
        "play_target": None,
    }


# --------------------------------------------------------------------------- #
# Rule-based fallback (used only when no LLM key configured)
# --------------------------------------------------------------------------- #
async def _rule_based_handle(db: Session, profile_id: int, message: str, session_id: int) -> dict[str, Any]:
    from app.services import recommendations

    smalltalk = _rule_smalltalk(message)
    if smalltalk is not None:
        _persist_assistant(db, session_id, smalltalk, [])
        return _response(smalltalk, [], session_id)

    history = _load_history(db, session_id)
    combined_text = " ".join(m["content"] for m in history if m["role"] == "user")

    genres = _find_genres(combined_text)
    exclusions = _find_exclusions(combined_text)
    runtime_max = _find_runtime_max(combined_text)
    seen_ids = _get_previously_suggested_ids(db, session_id)

    try:
        candidates = await recommendations.movie_night_candidates(
            db, profile_id, genres=genres or None, max_runtime=runtime_max, limit=24
        )
    except Exception:
        candidates = []

    if exclusions:
        candidates = [c for c in candidates if not (set(c.get("genre_ids") or []) & set(exclusions))]

    fresh_candidates = [c for c in candidates if c.get("id") not in seen_ids]

    if not fresh_candidates and candidates:
        try:
            discovered = await tmdb.discover(
                media_type="movie", page=2, genres=genres or None, sort_by="popularity.desc"
            )
            discovered_results = discovered.get("results", [])
            fresh_candidates = [c for c in discovered_results if c.get("id") not in seen_ids]
        except Exception:
            fresh_candidates = []

    top = fresh_candidates[:3]

    if not top:
        reply = (
            "I don't want to repeat the same picks. Tell me one thing to change "
            "(genre, mood, runtime, or something to avoid) and I'll look again."
            if seen_ids
            else "I couldn't find anything matching that â€” try being less specific."
        )
    elif len(seen_ids) > 0:
        reply = "Here are a few more recommendations for you:"
    else:
        reply = "How about one of these?"

    titles = [
        SuggestedTitle(
            tmdb_id=c["id"],
            media_type=c.get("media_type") or "movie",
            title=c.get("title") or c.get("name") or "Untitled",
            pitch=_title_pitch(c),
        )
        for c in top
    ]
    _persist_assistant(db, session_id, reply, [t.model_dump() for t in titles])
    return _response(reply, [t.model_dump() for t in titles], session_id)


# --- rule-based parsing helpers (fallback only) ---
def _has_recommendation_intent(message: str) -> bool:
    """Only a direct request should turn a conversation into a movie search."""
    text = message.lower()
    return bool(
        re.search(
            r"\b(recommend|suggest|pick|find me|what should i watch|what to watch|looking for|"
            r"give me .*?(?:movie|film|show|series)|watch tonight|stream tonight)\b",
            text,
        )
    )


def _rule_smalltalk(message: str) -> str | None:
    text = message.lower().strip().rstrip("?!. ")
    greeting = any(
        word in text.split()
        for word in ["hi", "hello", "hey", "yo", "hiya", "sup", "hola"]
    ) or any(phrase in text for phrase in ["good morning", "good afternoon", "good evening"])
    if greeting:
        return "Hey! I'm CineBot, your movie-night sidekick. What are you in the mood for tonight?"
    if re.search(r"\b(how are you|how's it going|how are things|you good|what's up)\b", text):
        return "I'm great! What kind of movie are you feeling?"
    if re.search(r"\b(bye|goodbye|see you|good night|goodnight)\b", text):
        return "Catch you later! Whenever you're ready for a movie night, I'm one tap away. ðŸ‘‹"
    return None


def _find_genres(message: str) -> list[int]:
    text = message.lower()
    found: list[int] = []
    for name, gid in GENRE_NAME_IDS.items():
        if re.search(rf"\b{re.escape(name)}\b", text):
            found.append(gid)
    for mood, ids in MOOD_GENRES.items():
        if mood in text:
            found.extend(ids)
    return list(dict.fromkeys(found))


def _find_exclusions(message: str) -> list[int]:
    text = message.lower()
    excluded: list[int] = []
    for name, gid in GENRE_NAME_IDS.items():
        if re.search(rf"\b(?:no|not|nothing with|avoid)\s+{re.escape(name)}\b", text) or (
            gid in (27, 53) and re.search(r"\b(?:not|no)\s+scary\b", text)
        ):
            excluded.append(gid)
    return list(dict.fromkeys(excluded))


def _find_runtime_max(message: str) -> int | None:
    text = message.lower()
    m = re.search(r"(?:under|less than|shorter than|max)\s+(\d+)\s*(?:min(?:ute)?s?|hours?)?", text)
    if m:
        value = int(m.group(1))
        if "hour" in m.group(0):
            return value * 60
        return value
    if re.search(r"\b(?:short|quick)\b", text):
        return 100
    return None


async def accept_title(db: Session, profile_id: int, tmdb_id: int, media_type: str = "movie") -> dict[str, Any]:
    """User confirmed a suggestion -> resolve and return action=play."""
    from app.services.playback.base import get_provider

    provider = get_provider()
    result = await provider.resolve(tmdb_id, media_type)
    detail = await tmdb.detail(media_type, tmdb_id)
    return {
        "reply": f"Enjoy! Launching **{detail.get('title') or detail.get('name')}** now.",
        "suggested_titles": [],
        "session_id": None,
        "action": "play",
        "play_target": {
            "tmdb_id": tmdb_id,
            "media_type": media_type,
            "stream_url": result.stream_url,
            "content_type": result.content_type,
            "expires_at": result.expires_at.isoformat(),
            "poster": detail.get("poster_path"),
            "title": detail.get("title") or detail.get("name"),
        },
    }

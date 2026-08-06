# Apollo

A legal, TMDB-powered movie & series streaming/discovery platform with an AI companion ("CineBot") that plans your movie night and plays the pick.

**Phase 1 MVP scaffold** — everything runs locally without any TMDB/streaming keys. Movies & series play via the vidsrc-embed.ru embed player (uses the app's own TMDB IDs); add your TMDB key for real content metadata.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + Tailwind CSS 3 |
| Backend | Python 3.14 + FastAPI + SQLAlchemy 2 |
| Database | SQLite by default (dev) / PostgreSQL (docker-compose) |
| Cache & rate limiting | Redis when available, in-memory fallback otherwise |
| Auth | JWT (access+refresh) in **httpOnly cookies**, bcrypt passwords |
| Playback | Pluggable `PlaybackProvider` interface + vidsrc-embed.ru embed player |

## Repo layout

```
backend/
  app/
    main.py            # app factory, CORS, lifespan
    db.py              # engine / session / init_db
    models.py          # users, profiles, preferences, watch_history,
                       # watchlist, ratings, chat_*, playback_sources
    schemas.py         # Pydantic input validation
    core/
      config.py        # env-driven settings
      security.py      # bcrypt + JWT helpers
      cache.py         # Redis with in-memory fallback
      ratelimit.py     # per-surface rate limits (login/general/chat/playback)
    api/
      deps.py          # current user/profile, cookie helpers
      router.py
      routes/
        auth.py        # register/login/logout/refresh, Google OAuth stub
        content.py     # cached TMDB proxy: browse, search, detail, similar
        me.py          # profiles, preferences, watchlist, history, ratings
        chatbot.py     # CineBot endpoints (rate-limited)
        playback.py    # resolve stream, per-account concurrency cap
    services/
      tmdb.py          # cached TMDB client (key never leaves the server)
      recommendations.py  # content-based ranking
      chatbot.py       # rule-based Phase 1 assistant + Movie Night flow
      playback/
        base.py        # PlaybackProvider ABC + registry
        vidsrc.py      # vidsrc-embed.ru embed provider
  tests/               # pytest smoke suite (auth, watchlist, playback, chat)
frontend/
  app/                 # pages: home, browse, search, movie/tv detail, watch, login, my-list
  components/          # Navbar, MovieRow, MovieCard, Player, ChatBot, TitleActions, skeletons
  lib/                 # api/image helpers, typed fetch wrapper
```

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt      # Windows
cp .env.example .env                                  # then edit .env
.\.venv\Scripts\python run.py                         # http://localhost:8000
```

Interactive docs at http://localhost:8000/docs.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev                                           # http://localhost:3000
```

### 3. (Optional) PostgreSQL + Redis

```bash
docker compose up -d postgres redis
```

Then set `DATABASE_URL` and `REDIS_URL` in `backend/.env` (see `.env.example`). Without Redis the app falls back to an in-memory cache/rate limiter.

## Adding real data

1. **TMDB** — get a key at https://www.themoviedb.org/settings/api, set `TMDB_API_KEY` (or the read-access token) in `backend/.env`. TMDB is metadata-only by law/terms; the app never streams from TMDB.
2. **Playback** — the app streams via the **vidsrc-embed.ru** embed player. It uses the same TMDB IDs the app already has, so no ID mapping or keys are needed. Set `PLAYBACK_PROVIDER=vidsrc` in `backend/.env` (the default). Movies resolve to `https://vidsrc-embed.ru/embed/movie/{id}`, series/episodes to `https://vidsrc-embed.ru/embed/tv/{id}/{season}-{episode}` (season/episode via the season/episode query on the watch URL). The embed reports playback progress back to the app for watch-history and resume positioning.
3. Add `TMDB_API_KEY` and restart the backend. The home page rows, browse, search, and the chatbot will start working.

## Verified flows

- Register → auto-creates profile → login/logout/refresh via httpOnly cookies
- Browse/search/detail (cached TMDB proxy, SSR with skeleton loaders)
- Watchlist, ratings, watch-history (progress + completed)
- Playback resolve → vidsrc-embed.ru embed player → progress reported to history (accurate resume)
- **Movie Night**: hit the red button (or open CineBot) → "pick something for tonight" → bot suggests titles with pitches → "Play now" resolves playback and navigates straight to the player
- Chatbot is rule-based (mood/genre/runtime/intent parsing); swap in LLM calls in `services/chatbot.py` for Phase 2 pitch generation

## Security & operations (from the plan, built-in)

- All API keys are server-side only; the browser talks only to the FastAPI backend.
- Passwords hashed with bcrypt; tokens are short-lived JWT in `httpOnly` cookies (`SameSite=lax`, `Secure` in production).
- Every input is validated by Pydantic schemas; queries use SQLAlchemy (parameterized).
- Rate limiting per surface — login (5/15m), general API (120/m), chat (20/h), playback (30/m) — with `429` + `Retry-After`.
- Playback is unlimited per account (no concurrent-stream cap); abuse is mitigated by per-surface rate limiting.
- TMDB responses cached (Redis or memory) so the quota isn't blown per page load.
- External calls (TMDB) have timeouts and degrade to clean error states instead of crashing; the UI shows fallback messages.
- `npm audit`: 0 vulnerabilities (deps pinned + overrides). Run `pip-audit`/`npm audit` in CI.

## Tests

```bash
cd backend
.\.venv\Scripts\python -m pytest        # 6 smoke tests
.\.venv\Scripts\ruff check app tests    # lint
```

## Roadmap status

- **Done (Phase 1 core):** content browse/search/detail, auth+profiles, player+resume, rule-based chatbot, Movie Night flow, playback abstraction, security/rate-limiting/caching.
- **Next (Phase 2):** watchlist-driven homepage, LLM pitches, cross-device resume, email verification, PWA, admin dashboard.
- See the project spec (the original Apollo plan brief) for the full Phase 2–4 feature list.

## Legal

TMDB is used for metadata only and must be attributed per its terms (display "This product uses the TMDB API but is not endorsed or certified by TMDB." on the UI — add it before shipping). Playback runs through the vidsrc-embed.ru embed player.

# Apollo — Production Deployment Guide

This guide walks you through deploying Apollo so the **frontend** (Vercel) talks to a
**production backend** (Render / Railway / Fly.io) instead of `localhost`.

> **Zero `localhost` in production.** Every API URL is environment-driven. If you still see
> requests to `http://localhost:8000` in your browser, it means `NEXT_PUBLIC_API_URL` was not
> set on the deployed frontend.

```
Users
   │
   ▼
Vercel Frontend              NEXT_PUBLIC_API_URL → https://<your-api>.onrender.com
   │
   ▼
Production Backend (Render / Railway / Fly.io)
   ├── PostgreSQL
   ├── Redis
   ├── TMDB API
   └── Auth (JWT cookies)
```

---

## 0. Architecture & security notes

- **CORS** is restrictive (no `*`) and credential-enabled. Frontend origins are read from
  `CORS_ORIGINS` (comma-separated, no wildcard allowed).
- **Secrets** (`SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, `TMDB_*`,
  LLM keys) are injected via each host's environment — **never committed**. Only `.env.example`
  files are checked in.
- **Config fails fast**: in `production`, `APP_ENV=production` refuses to boot with a default
  `SECRET_KEY` or a `sqlite://` database URL (`config.ensure_production_ready()`).

---

## 2. Environment variables — Backend

| Variable | Purpose | Example / Required |
|---|---|---|
| `APP_ENV` | `development` / `test` / `production` | `production` |
| `SECRET_KEY` | Server signing secret (used if no `JWT_SECRET`) | random 32+ chars |
| `JWT_SECRET` | Optional override for JWT signing | random 32+ chars |
| `CORS_ORIGINS` | Comma-separated allowed browser origins. **No `*`.** | `https://apollo-94zv.vercel.app` |
| `COOKIE_SAMESITE` | `lax` (dev) or `none` (prod, cross-site cookies) | `none` |
| `DATABASE_URL` | PostgreSQL connection string (**never sqlite in prod**) | `postgresql+psycopg://user:pass@host:5432/db` |
| `REDIS_URL` | Redis URL (fallback to in-memory if unreachable) | `redis://...:6379` |
| `TMDB_API_KEY` / `TMDB_API_READ_ACCESS_TOKEN` | Required for real content | from the TMDB dashboard |
| `TMDB_API_BASE_URL` | TMDB base | `https://api.themoviedb.org/3` |
| `LLM_PROVIDER` / `GEMINI_API_KEY` / `DEEPSEEK_API_KEY` | CineBot LLM | optional |
| `RATE_LIMIT_*` | Rate-limit specs | defaults provided |
| `ACCESS_TOKEN_MINUTES` / `REFRESH_TOKEN_DAYS` | Token lifetimes | defaults |

---

## 3. Configuration — Frontend (Vercel)

In the Vercel project (**Settings → Environment Variables**), set:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<your-backend-domain>` (no trailing slash) |
| `NEXT_PUBLIC_TMDB_IMAGE_BASE` | `https://image.tmdb.org/t/p` |

`NEXT_PUBLIC_*` vars are inlined at **build time**, so you must also set them for **Production** + **Preview**
environments and redeploy after changing them.

The frontend does **not** proxy `/api` — it calls `NEXT_PUBLIC_API_URL` directly. If you prefer a
same-origin setup, serve the API behind a reverse proxy (e.g. `nginx`/Traefik) and set
`NEXT_PUBLIC_API_URL=/api`.

---

## 4. Backend deployment

Local dev: `backend/.env` (gitignored) + `uvicorn app.main:app --reload`. Health check at `/health`.

### Render
`backend/render.yaml` is included. Points:
1. Import the repo (root = `backend`) or use **Blueprint** → `render.yaml`.
2. **Build:** `pip install -r requirements.txt` | **Start:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2`.
3. **Health check path:** `/health`.
4. Set env vars (table above). `FRONTEND_URL`/`OAUTH_REDIRECT_URI` must be public.
5. Attach the Postgres + Redis instances, then set `DATABASE_URL`/`REDIS_URL` to their connection strings.

### Railway
Use `backend/railway.json` (Nixpacks). Set `startCommand` outputs from the web. Add Postgres &
Redis plugins; copy `DATABASE_URL`/`REDIS_URL`.

### Fly.io
`backend/fly.toml` + `Dockerfile`. Deployment:
```bash
cd backend
fly launch --image-buffer  (or `fly apps create apollo-api`)
fly secrets set SECRET_KEY="..." DATABASE_URL="..." REDIS_URL="..." TMDB_API_KEY="..." CORS_ORIGINS="..." COOKIE_SAMESITE=none
fly deploy
```

Make sure `CORS_ORIGINS` includes your Vercel frontend origin.

---

## 5. Frontend deployment (Vercel)

1. Push `frontend/` (or repo root) to Vercel.
2. Set the environment variables from section 3, then **Deploy (Redeploy)** after env changes.
3. Framework preset: **Next.js**. Build command: `npm run build`. Output: `out`/`.next`.

### Vercel config tip
Add a health-check on the frontend isn't required; the app pages call `GET {API_URL}/health`
before loading content and render a clear error like *"Backend unreachable"* when it fails.

---

## 6. Database

- **Production:** PostgreSQL. Set `DATABASE_URL` to the platform's connection string. The app
  uses **psycopg v3** (`postgresql+psycopg://`). Bare `postgres://` / `postgresql://` /
  `postgresql+psycopg2://` connection strings injected by providers are **automatically coerced
  to the psycopg3 dialect** at startup (`config.coerce_postgres_dialect`), so **psycopg2 is never
  required**.
- Schema is auto-created on startup (`init_db`). No migrations tooling is bundled yet; for schema
  evolution add Alembic.
- Default dev DB is `sqlite:///./apollo.db` (ignored by git).

## 7. Redis

- Optional; used for cache + rate limiting. If `REDIS_URL` is unreachable the app falls back to
  an in-memory implementation (fine for single instance).
- Production on multi-instance deploys: **use Redis** so rate limits/cache are shared.

## 8. TMDB

- Set `TMDB_API_KEY` (or `TMDB_API_READ_ACCESS_TOKEN`). Keys are server-side only.
- The `/health` endpoint returns `tmdb: true` only after a successful probe of
  `https://api.themoviedb.org/3/configuration`.

## 9. Authentication

- Tokens: short-lived JWT access (15 min) + long-lived refresh (30 d), in **httpOnly cookies**
  and also returned in the response body (stored in **localStorage**).
- **SameSite:** set `COOKIE_SAMESITE=none` in production when the frontend and API are on
  different hosts (cross-site). `Secure` is forced automatically in production.
- Watching movies does **not** require an account. Sign-in is only needed for account features:
  watch history, the "Continue Watching" row, and the CineBot chatbot.

## 10. CORS

- Backend reads `CORS_ORIGINS`. No wildcard. `allow_credentials=True` requires explicit origins.
- Dev: `http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000`
- Prod: `https://apollo-94zv.vercel.app` (add any new frontend domains here).

---

## 11. Build commands & health checks

- **Backend install:** `pip install -r requirements.txt`
- **Backend run:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Backend health:** `GET /health`
  ```json
  {
    "status": "ok",
    "database": true,
    "redis": true,
    "tmdb": true,
    "version": "0.1.0",
    "environment": "production"
  }
  ```
- **Frontend install:** `npm install`
- **Frontend build:** `npm run build`
- **Frontend dev:** `npm run dev`
- **Lint/typecheck (frontend):** `npm run typecheck`
- **Backend tests:** `pytest`

---

## 12. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `CORS policy` blocked in browser to `localhost` proxy | `NEXT_PUBLIC_API_URL` unset on Vercel. Set it to the deployed API + redeploy. |
| `Backend unreachable` on home page | API down or wrong `NEXT_PUBLIC_API_URL`. Check `GET {URL}/health`. |
| `access_token` 401 loops | Clock skew or wrong `JWT_SECRET`. Set a fixed `JWT_SECRET` and match on both sides. |
| Cookies not sent across sites | Ensure same-site **SameSite=None** + **Secure**; or rely on localStorage Bearer tokens (default). |
| `_not-found` / 404 / Suspense errors building | Pages using `useSearchParams()` wrapped in `<Suspense>` (already done for Navbar/Watch/MovieNight). |
| `No module named 'psycopg2'` | Provider injected a bare `postgresql://` URL. Already auto-coerced to psycopg3 (`postgresql+psycopg://`); this needs no action. If it persists, confirm `psycopg[binary]` installed and `DATABASE_URL` starts with `postgresql+psycopg://`. |
| TMDB empty feed | Backend has no `TMDB_API_KEY`/token. Check `/health` → `tmdb`. |
| Rate limit (429) | Limits are per authenticated user where possible and per IP otherwise; a `429` includes `Retry-After`, and the frontend auto-retries reads once (`Retry-After <= 5s`) then shows a friendly "slow down" message on any surface. If you genuinely hit it: raise the relevant `RATE_LIMIT_*` var or, behind a proxy (Render/Railway/nginx), set `RATE_LIMIT_TRUST_FORWARDED=true` so the real client IP is used instead of the shared proxy IP. |

---

## 13. Production verification checklist

- [ ] `NEXT_PUBLIC_API_URL` set on Vercel (Prod + Preview) and redeployed — no `localhost` in network requests.
- [ ] `GET {API_URL}/health` returns `status: ok`, `database: true`, `redis: true`.
- [ ] `tmdb: true` in `/health` (TMDB key working).
- [ ] `CORS_ORIGINS` contains `https://apollo-94zv.vercel.app`; no `*`.
- [ ] `SECRET_KEY`/`JWT_SECRET` set (strong, random).
- [ ] `COOKIE_SAMESITE=none`, `APP_ENV=production` on the API host.
- [ ] Email sign-in/register round-trip works (guest can watch without an account).
- [ ] `npm run build` completes with no errors.
- [ ] `git grep -n "localhost"` matches only docs/dev defaults (`.env.example`, `Procfile`, README).
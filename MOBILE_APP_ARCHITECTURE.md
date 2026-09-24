# Apollo Mobile App & Playback Architecture Guide

This document explains how the **Apollo** application operates on mobile devices (via both Mobile Web and native Capacitor apps), how API connectivity is handled, and how movies and TV series are discovered and streamed.

---

## 📖 Table of Contents
1. [Overview](#1-overview)
2. [Dual Operating Modes](#2-dual-operating-modes)
   - [Mobile Web Browser Mode](#a-mobile-web-browser-mode)
   - [Capacitor Native App Mode](#b-capacitor-native-app-mode)
3. [API URL & Network Connectivity Engine](#3-api-url--network-connectivity-engine)
4. [Movie & Series Discovery Pipeline](#4-movie--series-discovery-pipeline)
5. [Playback Engine: How Movies & Shows Play](#5-playback-engine-how-movies--shows-play)
   - [Playback Resolution Sequence](#a-playback-resolution-sequence)
   - [Pluggable Provider System](#b-pluggable-provider-system)
   - [Automated Provider Fallback](#c-automated-provider-fallback)
   - [Player Mechanics](#d-player-mechanics)
6. [How to Build, Sync, and Run on Mobile](#6-how-to-build-sync-and-run-on-mobile)

---

## 1. Overview

Apollo is built with a unified cross-platform architecture:
- **Frontend**: Next.js 15 (React 19, TailwindCSS, TypeScript).
- **Mobile Runtime**: Apache Capacitor 6/7 wrapping the Next.js static export (`out/`).
- **Backend API**: Python FastAPI (SQLAlchemy, Redis caching, Pydantic, rate-limiting).
- **Content Metadata**: TMDB (The Movie Database) proxied and cached server-side.
- **Playback Providers**: Pluggable stream resolution engines (`framextv`, `cinemaos`, `vidsrc`, `videasy`, `stellar`).

---

## 2. Dual Operating Modes

### A. Mobile Web Browser Mode
When a user opens Apollo on a phone browser (e.g. Chrome or Safari on Android/iOS via local Wi-Fi `http://192.168.x.x:3000` or production domain `https://www.missapollo.me`):
1. Next.js renders mobile-optimized responsive components (`MobileHomeView`, `MobileDetailView`, `MobileBottomNav`, etc.).
2. The browser initiates standard HTTPS/HTTP requests to the backend API (`https://apollo-makx.onrender.com`).
3. CORS headers are handled dynamically via FastAPI CORS middleware configured with wildcard local network IP regex patterns (`allow_origin_regex`).

### B. Capacitor Native App Mode
When running as an Android APK or iOS App:
1. Next.js builds an optimized static export (`output: "export"` in `next.config.mjs`) into the `frontend/out` folder.
2. Capacitor copies these static files into the native app package (`android/app/src/main/assets/public`).
3. Android WebView loads the local bundle using the `https://localhost` scheme (configured via `capacitor.config.ts`).
4. Native API requests are executed through `CapacitorHttp` (bypassing CORS) with automated fallback to web `fetch`.

---

## 3. API URL & Network Connectivity Engine

### The Problem It Solved
On a mobile device, `localhost` points to the **phone itself** (`127.0.0.1`), where no Python backend is running. If an app attempts to call `http://localhost:8000` on a phone, the request fails with a connection error (*"We couldn't connect right now"*).

### Resolution Engine (`frontend/lib/api.ts`)
The `getResolvedApiUrl()` function automatically determines the correct API endpoint based on the execution context:

```typescript
export function getResolvedApiUrl(): string {
  if (typeof window !== "undefined") {
    const isCapacitorNative =
      !!(window as any).Capacitor?.isNativePlatform?.() ||
      window.location.protocol === "capacitor:" ||
      window.location.protocol === "file:";

    const hostname = window.location.hostname;
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
    const explicit = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");

    // 1. Native Mobile App (Capacitor Android/iOS) -> Production Backend
    if (isCapacitorNative) {
      if (explicit && !isLocalhostUrl(explicit)) return explicit;
      return PRODUCTION_API_URL; // https://apollo-makx.onrender.com
    }

    // 2. Mobile Browser on local network or deployed domain -> Production Backend
    if (!isLocalHost) {
      if (explicit && !isLocalhostUrl(explicit)) return explicit;
      return PRODUCTION_API_URL;
    }

    // 3. Desktop Dev Environment -> Local Backend
    if (explicit) return explicit;
    return DEFAULT_DEV_API_URL; // http://localhost:8000
  }
  return API_URL;
}
```

---

## 4. Movie & Series Discovery Pipeline

1. **Home Catalog Loading**:
   - `MobileHomeView.tsx` issues parallel cached requests to:
     - `/api/v1/content/trending?time_window=week`
     - `/api/v1/content/popular?media_type=movie`
     - `/api/v1/content/popular?media_type=tv`
     - `/api/v1/content/top-rated?media_type=movie`
   - Data is rendered using mobile carousels (`MobileMovieCarousel.tsx`) and hero billboards (`MobileHero.tsx`).

2. **Browse & Filtering**:
   - `/browse` queries `/api/v1/content/discover` with filters for genre, year, minimum rating, language, origin country, and sorting options.

3. **Title Details (`DetailView.tsx` & `MobileDetailView.tsx`)**:
   - When a user taps any movie or TV series card:
     - Navigates to `/movie/[id]` or `/tv/[id]`.
     - Fetches detailed metadata from `/api/v1/content/{media_type}/{id}` (synopsis, runtime, vote rating, genres, cast credits, tagline).
     - Fetches similar recommendations from `/api/v1/content/{media_type}/{id}/similar`.
     - For TV shows: fetches season episode lists from `/api/v1/content/tv/{id}/season/{season}`.

---

## 5. Playback Engine: How Movies & Shows Play

```
                                  ┌───────────────────────────┐
                                  │   User taps "Watch Now"   │
                                  └─────────────┬─────────────┘
                                                │
                                                ▼
                                 ┌─────────────────────────────┐
                                 │  POST /playback/resolve     │
                                 │  (tmdb_id, media_type, etc) │
                                 └──────────────┬──────────────┘
                                                │
                ┌───────────────────────────────┼───────────────────────────────┐
                ▼                               ▼                               ▼
       ┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
       │ 1. frameXTV     │ ──(fails)─► │ 2. CinemaOS     │ ──(fails)─► │ 3. VidSrc       │
       │ (PEKKA/Archer)  │             │ (cinemaos.tech) │             │ (vidsrc-embed)  │
       └────────┬────────┘             └────────┬────────┘             └────────┬────────┘
                │ (success)                     │ (success)                     │ (success)
                └───────────────────────────────┼───────────────────────────────┘
                                                │
                                                ▼
                                  ┌───────────────────────────┐
                                  │ Direct Stream / Embed URL │
                                  └─────────────┬─────────────┘
                                                │
                                                ▼
                                  ┌───────────────────────────┐
                                  │     Player Component      │
                                  │ (HLS.js / IFrame Embed)   │
                                  └───────────────────────────┘
```

### A. Playback Resolution Sequence
When a user clicks **Play Now** on a movie or selects an episode of a TV show:
1. The app routes to `/watch/[mediaType]/[id]` (or `/watch/tv/[id]?season=1&episode=1`).
2. `WatchClient.tsx` executes a request to `/api/v1/playback/resolve`.

### B. Pluggable Provider System
The backend contains a provider registry (`app/services/playback/base.py`) supporting multiple servers:

| Provider Name | Domain / Service | Features |
| :--- | :--- | :--- |
| `framextv` | `framextv.tech` | Server extraction: **P.E.K.K.A IV** (1080p high bitrate), **Barbarian** (subtitle decryption), **Archer** (4K & multi-audio), **Goblin** (mirror). |
| `cinemaos` | `cinemaos.tech` | Fast clean embed player. |
| `vidsrc` | `vidsrc-embed.ru` | Multi-mirror embed source. |
| `videasy` | `videasy.net` | Clean HTML5 stream source. |
| `stellar` | `stellar.tech` | 4K Ultra HD playback server. |

### C. Automated Provider Fallback
To ensure 100% playback reliability, `WatchClient.tsx` executes an automatic provider fallback loop:
If `framextv` fails or is unavailable for a specific title, the app seamlessly attempts `cinemaos`, `vidsrc`, `videasy`, and `stellar` in sequence until a valid stream URL is resolved.

### D. Player Mechanics (`Player.tsx`)
- **Embed vs Native Stream**: If `content_type` is `text/html`, the player embeds the provider securely inside a responsive iframe container. If HLS (`application/x-mpegURL`), `Hls.js` initializes native video streaming.
- **Server Switcher**: Users can manually select between Server 1, Server 2, Server 3, Server 4, and Server 5 directly from the video action bar.
- **Cue Skipping**: Loads intro/outro cues from `/api/v1/playback/cues` to display **Skip Intro** and **Skip Outro** buttons.
- **Watch History & Progress**: Progress is automatically saved every 15 seconds to local storage and synchronized to user history (`/api/v1/me/history`).

---

## 6. How to Build, Sync, and Run on Mobile

### Step 1: Export Next.js Build
```bash
npm --prefix frontend run build
```

### Step 2: Sync Assets to Android Native Project
```bash
cd frontend && npx cap sync android
```

### Step 3: Launch in Android Studio / Build APK
```bash
cd frontend && npx cap open android
```

From Android Studio:
1. Connect your Android phone via USB (with USB Debugging enabled) or start an Android Virtual Device (AVD).
2. Click **Run 'app'** (or select **Build -> Build APK(s)** to generate the `.apk` file for direct installation).

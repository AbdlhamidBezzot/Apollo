"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { posterUrl } from "@/lib/api";
import { classifyError } from "@/lib/errors";
import { get, post, put } from "@/lib/http";

import type {
  Genre,
  MovieNightDecideResponse,
  MovieNightJoinResponse,
  MovieNightRoomDetail,
  MovieNightSuggestResponse,
  RoomCreateResponse,
  SuggestedTitle,
} from "@/lib/types";

interface EnrichedSuggestion extends SuggestedTitle {
  poster_path?: string | null;
  vote_average?: number;
}

const MOODS = [
  { value: "feel-good", label: "Feel-good" },
  { value: "funny", label: "Funny" },
  { value: "cozy", label: "Cozy" },
  { value: "scary", label: "Scary" },
  { value: "action-packed", label: "Action-packed" },
  { value: "light", label: "Light" },
  { value: "chill", label: "Chill" },
  { value: "sad", label: "Moody / sad" },
  { value: "exciting", label: "Exciting" },
];

async function enrich(suggestions: SuggestedTitle[]): Promise<EnrichedSuggestion[]> {
  return Promise.all(
    (suggestions || []).map(async (s) => {
      const mediaType = s.media_type || "movie";
      try {
        const detail = await get<{ poster_path: string | null; vote_average: number }>(
          `/api/v1/content/${mediaType}/${s.tmdb_id}`
        );
        return { ...s, media_type: mediaType, ...detail };
      } catch {
        return { ...s, media_type: mediaType };
      }
    })
  );
}

function StatusPill({ ready }: { ready: boolean }) {
  return ready ? (
    <span className="rounded-full bg-badge-rating/15 px-2 py-0.5 text-[11px] font-bold text-badge-rating">✓ prefs in</span>
  ) : (
    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-text-muted">waiting…</span>
  );
}

export function MovieNightRoomClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [code, setCode] = useState((searchParams.get("join") || "").toUpperCase());
  const [room, setRoom] = useState<MovieNightRoomDetail | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busySuggest, setBusySuggest] = useState(false);
  const [suggestion, setSuggestion] = useState<MovieNightSuggestResponse | null>(null);
  const [titles, setTitles] = useState<EnrichedSuggestion[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [fav, setFav] = useState<number[]>([]);
  const [excl, setExcl] = useState<number[]>([]);
  const [runtime, setRuntime] = useState<number | "">("");
  const [mood, setMood] = useState<string>("");
  const [intensity, setIntensity] = useState<number | "">("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    get<{ genres: Genre[] }>("/api/v1/content/genres")
      .then((d) => setGenres(d.genres || []))
      .catch(() => {});
  }, []);

  const refresh = useCallback(async (c: string) => {
    try {
      const d = await get<MovieNightRoomDetail>(`/api/v1/movie-night-room/${c}`);
      setRoom(d);
    } catch {
      /* room may be gone */
    }
  }, []);

  useEffect(() => {
    if (!code || !joined) return;
    refresh(code);
    pollRef.current = setInterval(() => refresh(code), 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [code, joined, refresh]);

  const createRoom = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await post<RoomCreateResponse>("/api/v1/movie-night-room");
      setCode(r.code);
      setToken(r.token);
      setIsHost(true);
      setJoined(true);
      localStorage.setItem(`apollo:room:${r.code}`, r.token);
    } catch (err: unknown) {
      setError(classifyError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async (e?: FormEvent) => {
    e?.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c || busy) return;
    setBusy(true);
    setError(null);
    try {
      let res: MovieNightJoinResponse;
      if (user && !guestName.trim()) {
        res = await post<MovieNightJoinResponse>(`/api/v1/movie-night-room/${c}/join/account`);
      } else {
        res = await post<MovieNightJoinResponse>(`/api/v1/movie-night-room/${c}/join`, {
          guest_name: guestName.trim() || "Guest",
        });
      }
      setRoom(res.room);
      setToken(res.token);
      setIsHost(res.is_host);
      setJoined(true);
      localStorage.setItem(`apollo:room:${c}`, res.token);
    } catch (err: unknown) {
      setError(classifyError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const savePrefs = async () => {
    if (!token || !code) return;
    setBusy(true);
    setError(null);
    try {
      const d = await put<MovieNightRoomDetail>(
        `/api/v1/movie-night-room/${code}/preferences?token=${encodeURIComponent(token)}`,
        {
          favorite_genres: fav,
          excluded_genres: excl,
          max_runtime_minutes: runtime === "" ? null : runtime,
          mood: mood || null,
          intensity: intensity === "" ? null : intensity,
        }
      );
      setRoom(d);
    } catch (err: unknown) {
      setError(classifyError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const suggest = async () => {
    if (!token || !code) return;
    setBusySuggest(true);
    setError(null);
    setSuggestion(null);
    setTitles([]);
    try {
      const res = await post<MovieNightSuggestResponse>(
        `/api/v1/movie-night-room/${code}/suggest?token=${encodeURIComponent(token)}`
      );
      setSuggestion(res);
      const enriched = await enrich(res.suggested_titles || []);
      setTitles(enriched);
    } catch (err: unknown) {
      setError(classifyError(err).message);
    } finally {
      setBusySuggest(false);
    }
  };

  const playPick = async (t: EnrichedSuggestion) => {
    if (!token || !code) return;
    setBusy(true);
    setError(null);
    try {
      const res = await post<MovieNightDecideResponse>(
        `/api/v1/movie-night-room/${code}/decide?token=${encodeURIComponent(token)}`,
        { tmdb_id: t.tmdb_id, media_type: t.media_type }
      );
      if (res.action === "play" && res.play_target) {
        sessionStorage.setItem("apollo:play", JSON.stringify(res.play_target));
        router.push(`/watch/${res.play_target.media_type}/${res.play_target.tmdb_id}`);
      }
    } catch (err: unknown) {
      setError(classifyError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const doLeaveRoom = async () => {
    if (token && code) {
      try {
        await post(`/api/v1/movie-night-room/${code}/leave?token=${encodeURIComponent(token)}`);
      } catch {}
      localStorage.removeItem(`apollo:room:${code}`);
    }
    setJoined(false);
    setRoom(null);
    setToken(null);
    setCode("");
    setIsHost(false);
  };

  const shareLink = code
    ? `${window.location.origin}/movie-night?join=${code}`
    : "";

  const toggle = (arr: number[], setArr: (v: number[]) => void, id: number) => {
    setArr(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };

  if (!joined) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="glass rounded-3xl p-7 shadow-glass">
          <h1 className="mb-1 text-2xl font-extrabold tracking-tightest text-text-vivid">Movie Night Room</h1>
          <p className="mb-6 text-sm text-text-muted">
            Pick a movie together, then it plays on the host&apos;s screen.
          </p>
          <button
            onClick={createRoom}
            disabled={busy || loading || !user}
            className="mb-4 w-full rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-brand-glow transition hover:bg-brand-soft disabled:opacity-40"
          >
            {busy ? "Creating…" : !user ? "Sign in to host a room" : "Start a Movie Night Room"}
          </button>
          {!user && (
            <button
              onClick={() => router.push("/login")}
              className="mb-6 w-full rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-text-vivid"
            >
              Sign in
            </button>
          )}

          <form onSubmit={joinRoom} className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-text-muted">Or join with a code</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="APLO-K3F9"
              aria-label="Room code"
              className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 font-mono text-sm uppercase text-text-vivid outline-none placeholder:text-text-muted focus:border-brand/50"
            />
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Your name (optional)"
              aria-label="Guest name"
              className="w-full rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-text-vivid outline-none placeholder:text-text-muted focus:border-brand/50"
            />
            <button
              type="submit"
              disabled={busy || code.trim().length < 6}
              className="w-full rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-text-vivid transition hover:border-brand/50 disabled:opacity-40"
            >
              Join room
            </button>
          </form>

          {error && <p className="mt-3 text-xs text-brand-soft">{error}</p>}
        </div>
      </div>
    );
  }

  const total = room?.participants?.length || 0;
  const readyCount = room?.participants?.filter((p) => p.has_preferences).length || 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-brand-soft">Movie Night Room</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tightest text-text-vivid">Room {room?.code}</h1>
          {isHost && <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-bold text-brand-soft">host</span>}
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {isHost ? `Waiting on the group… ${readyCount}/${total} preferences in.` : `Host: ${room?.host_name}`}
        </p>
        {shareLink && (
          <button
            onClick={() => navigator.clipboard.writeText(shareLink)}
            className="mt-2 rounded-full border border-white/10 px-3 py-1 text-xs text-text-muted transition hover:border-brand/50"
          >
            Copy invite link
          </button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Participants */}
        <section className="glass rounded-3xl p-5 shadow-glass">
          <h2 className="mb-3 text-sm font-bold text-text-vivid">
            Who&apos;s in · {readyCount}/{total} ready
          </h2>
          <div className="mb-4 flex h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="bg-brand transition-all duration-500"
              style={{ width: total ? `${(readyCount / total) * 100}%` : "0%" }}
            />
          </div>
          <ul className="space-y-2">
            {(room?.participants || []).map((p, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-text-vivid">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  {p.name}
                  {p.is_host && <span className="text-[10px] uppercase text-text-muted">host</span>}
                </span>
                <StatusPill ready={p.has_preferences} />
              </li>
            ))}
          </ul>
          <button
            onClick={doLeaveRoom}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-400 transition hover:bg-red-500/20 hover:border-red-500/50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {isHost ? "Leave & Dissolve Room" : "Leave Room"}
          </button>
        </section>

        {/* Preferences */}
        <section className="glass rounded-3xl p-5 shadow-glass">
          <h2 className="mb-3 text-sm font-bold text-text-vivid">Your preferences</h2>
          <p className="mb-3 text-xs text-text-muted">Quick answers the group merge uses:</p>

          <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">What are you into?</label>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => toggle(fav, setFav, g.id)}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  fav.includes(g.id) ? "bg-brand text-white" : "border border-white/10 text-text-muted hover:border-brand/50"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Definitely not</label>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => toggle(excl, setExcl, g.id)}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  excl.includes(g.id) ? "bg-brand text-white line-through" : "border border-white/10 text-text-muted hover:border-brand/50"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Mood</label>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(m.value)}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  mood === m.value ? "bg-brand text-white" : "border border-white/10 text-text-muted hover:border-brand/50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Max runtime (min)</label>
              <input
                type="number"
                value={runtime}
                onChange={(e) => setRuntime(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="120"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-vivid outline-none focus:border-brand/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-text-muted">Intensity (1–5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={intensity}
                onChange={(e) => setIntensity(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="3"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-text-vivid outline-none focus:border-brand/50"
              />
            </div>
          </div>

          <button
            onClick={savePrefs}
            disabled={busy}
            className="w-full rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-brand-glow transition hover:bg-brand-soft disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save preferences"}
          </button>

          {isHost && (
            <button
              onClick={suggest}
              disabled={busySuggest || readyCount < 1}
              className="mt-2 w-full rounded-full border border-brand/40 px-5 py-2.5 text-sm font-bold text-brand-soft transition hover:bg-brand/10 disabled:opacity-40"
            >
              {busySuggest ? "Finding a pick…" : "Propose a pick for the group"}
            </button>
          )}
        </section>
      </div>

      {error && <p className="mt-4 text-center text-xs text-brand-soft">{error}</p>}

      {suggestion && (
        <section className="glass mt-6 rounded-3xl p-5 shadow-glass">
          <h2 className="mb-2 text-sm font-bold text-text-vivid">Group pick</h2>
          <p className="mb-4 whitespace-pre-line text-sm text-text-vivid">{suggestion.reply}</p>
          <div className="space-y-2">
            {titles.map((s) => (
              <div key={s.tmdb_id} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                <div className="flex gap-2.5 p-2">
                  <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-md bg-bg-card">
                    <Image src={posterUrl(s.poster_path ?? null, "w185")} alt={s.title} fill sizes="64px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-vivid">{s.title}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
                      {typeof s.vote_average === "number" && s.vote_average > 0 ? (
                        <span className="rounded bg-badge-rating/15 px-1.5 font-bold text-badge-rating">★ {s.vote_average.toFixed(1)}</span>
                      ) : null}
                      <span className="uppercase">{s.media_type}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-text-muted">{s.pitch}</p>
                  </div>
                </div>
                {isHost && (
                  <button
                    onClick={() => playPick(s)}
                    disabled={busy}
                    className="block w-full border-t border-white/10 px-3 py-2 text-left text-xs font-bold text-brand-soft transition hover:bg-white/5 disabled:opacity-40"
                  >
                    ▶ Confirm & launch for the room
                  </button>
                )}
              </div>
            ))}
          </div>
          {!isHost && <p className="mt-3 text-xs text-text-muted">The host confirms the final pick and launches playback.</p>}
        </section>
      )}
    </div>
  );
}
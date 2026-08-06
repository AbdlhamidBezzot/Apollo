"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { get, post } from "@/lib/http";
import type { MovieNightRoomInfo } from "@/lib/types";

interface PlayTarget {
  tmdb_id: number;
  media_type: "movie" | "tv";
  season?: number | null;
  episode?: number | null;
  title: string;
}

function extractTarget(): PlayTarget | null {
  const m = window.location.pathname.match(/^\/(watch\/(movie|tv)|(movie|tv))\/(\d+)/);
  if (!m) return null;
  const media_type = (m[2] || m[3]) as "movie" | "tv";
  const tmdb_id = Number(m[4]);
  let season: number | null = null;
  let episode: number | null = null;
  if (m[1]?.startsWith("watch")) {
    const q = new URLSearchParams(window.location.search);
    season = Number(q.get("season") || 1);
    episode = Number(q.get("episode") || 1);
  }
  return { tmdb_id, media_type, season, episode, title: "" };
}

export function MovieNightModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<PlayTarget | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => {
      setTarget(extractTarget());
      setError(null);
      setOpen(true);
    };
    window.addEventListener("apollo:movie-night", handler);
    return () => window.removeEventListener("apollo:movie-night", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = extractTarget();
    setTarget(t);
    if (t && !t.title) {
      get<{ title?: string; name?: string }>(`/api/v1/content/${t.media_type}/${t.tmdb_id}`)
        .then((d) => setTarget((prev) => (prev ? { ...prev, title: d.title || d.name || "" } : prev)))
        .catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const createRoom = async () => {
    if (!target) {
      setError("Open a movie or series page to start a Movie Night room.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const room = await post<MovieNightRoomInfo>("/api/v1/movie-night/rooms", {
        tmdb_id: target.tmdb_id,
        media_type: target.media_type,
        season: target.season,
        episode: target.episode,
      });
      const base = `/watch/${target.media_type}/${target.tmdb_id}`;
      const qs = new URLSearchParams({ room: room.code });
      if (target.media_type === "tv") {
        if (target.season) qs.set("season", String(target.season));
        if (target.episode) qs.set("episode", String(target.episode));
      }
      router.push(`${base}?${qs.toString()}`);
    } catch (err: any) {
      setError(err.message || "Could not create the room.");
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async (e: FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      const room = await get<MovieNightRoomInfo>(`/api/v1/movie-night/rooms/${code}`);
      if (!room.tmdb_id || !room.media_type) {
        setError("This room has no title attached yet. Ask the host to start playback first.");
        return;
      }
      const base = `/watch/${room.media_type}/${room.tmdb_id}`;
      const qs = new URLSearchParams({ room: room.code });
      if (room.media_type === "tv") {
        if (room.season) qs.set("season", String(room.season));
        if (room.episode) qs.set("episode", String(room.episode));
      }
      router.push(`${base}?${qs.toString()}`);
    } catch (err: any) {
      setError(err.message || "Room not found. Check the code and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9950] flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
      <div
        className="glass animate-rise w-full max-w-md rounded-3xl p-6 shadow-glass"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Movie Night"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight text-text-vivid">Movie Night</h2>
          <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-text-muted transition hover:bg-white/5 hover:text-text-vivid" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          {target ? (
            <p className="text-sm text-text-muted">
              Start a synchronized watch room for{" "}
              <span className="font-semibold text-text-vivid">{target.title || "this title"}</span>. Share the invite code
              with friends — everyone&apos;s playback stays in sync with built-in chat.
            </p>
          ) : (
            <p className="text-sm text-text-muted">
              Open a movie or series page to start a Movie Night room for it.
            </p>
          )}
          <button
            onClick={createRoom}
            disabled={busy || !target}
            className="mt-3 w-full rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-brand-glow transition hover:bg-brand-soft disabled:opacity-40"
          >
            {busy ? "Creating…" : "Create room"}
          </button>
        </div>

        <form onSubmit={joinRoom} className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-text-muted">Or join with a code</p>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              aria-label="Room code"
              className="flex-1 rounded-full border border-white/10 bg-black/20 px-4 py-2 font-mono text-sm uppercase text-text-vivid outline-none placeholder:text-text-muted focus:border-brand/50"
            />
            <button
              type="submit"
              disabled={busy || joinCode.trim().length < 4}
              className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-text-vivid transition hover:border-brand/50 disabled:opacity-40"
            >
              Join
            </button>
          </div>
        </form>

        {error && <p className="mt-3 text-xs text-brand-soft">{error}</p>}
      </div>
    </div>
  );
}

"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/lib/playerContext";

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const sec = Math.floor(s % 60);
  const min = Math.floor((s / 60) % 60);
  const hr = Math.floor(s / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return hr > 0 ? `${hr}:${pad(min)}:${pad(sec)}` : `${min}:${pad(sec)}`;
}

const SWIPE_THRESHOLD = 80;

/**
 * MiniPlayer — docked 64px bar at the bottom of the screen (above bottom nav).
 * Contains the live <video> element (reused from GlobalPlayer's ref),
 * a thumbnail, title, play/pause button, and a dismiss button.
 *
 * Gestures:
 *  - Tap → expand back to watch page
 *  - Swipe left / right → dismiss (stop playback)
 */
export function MiniPlayer() {
  const player = usePlayer();
  const router = useRouter();
  const { videoRef, title, poster, playing, currentTime, duration, tmdbId, mediaType, season, episode } = player;

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const miniRef = useRef<HTMLDivElement>(null);

  const played = duration > 0 ? (currentTime / duration) * 100 : 0;

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    player.dismiss();
  };

  const expand = () => {
    player.setMode("portrait");
    const path =
      mediaType === "tv"
        ? `/watch/tv/${tmdbId}?season=${season}&episode=${episode}`
        : `/watch/movie/${tmdbId}`;
    router.push(path);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    touchStartRef.current = null;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    // Swipe left or right → dismiss
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dy) < 40) {
      player.dismiss();
      return;
    }
    // Swipe up → expand
    if (dy < -SWIPE_THRESHOLD && Math.abs(dx) < 40) {
      expand();
      return;
    }
  };

  return (
    <div
      ref={miniRef}
      id="mini-player"
      className="mini-player-enter fixed bottom-safe-bottom left-0 right-0 z-50 flex cursor-pointer flex-col border-t border-white/10 bg-[#09090b]/95 shadow-2xl backdrop-blur-xl"
      style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}
      onClick={expand}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="button"
      tabIndex={0}
      aria-label={`Mini player: ${title}. Tap to expand.`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") expand(); }}
    >
      {/* Progress line */}
      <div className="h-[2px] w-full bg-white/10">
        <div
          className="h-full bg-[var(--brand-accent)] transition-all duration-300"
          style={{ width: `${played}%` }}
        />
      </div>

      {/* Main row */}
      <div className="flex h-16 items-center gap-3 px-3">
        {/* Thumbnail / live video */}
        <div className="relative h-10 w-[72px] shrink-0 overflow-hidden rounded-lg bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {poster ? (
            <img
              src={poster}
              alt={title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-white/10" />
          )}
          {/* Live video element injected here via DOM manipulation in GlobalPlayer */}
        </div>

        {/* Title */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{title || "Now playing"}</p>
          <p className="font-mono text-[11px] text-white/50">
            {fmtTime(currentTime)} · {fmtTime(duration)}
          </p>
        </div>

        {/* Play / Pause */}
        <button
          id="mini-player-playpause"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Dismiss */}
        <button
          id="mini-player-dismiss"
          onClick={dismiss}
          aria-label="Stop and close player"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

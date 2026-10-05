"use client";

import { useCallback } from "react";
import { ProgressBar } from "@/components/player/ProgressBar";
import { usePlayer } from "@/lib/playerContext";

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const sec = Math.floor(s % 60);
  const min = Math.floor((s / 60) % 60);
  const hr = Math.floor(s / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return hr > 0 ? `${hr}:${pad(min)}:${pad(sec)}` : `${min}:${pad(sec)}`;
}

interface PlayerControlsProps {
  visible: boolean;
  isFullscreen: boolean;
  onMinimize: () => void;
  onFullscreen: () => void;
  onSettings: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  showSkipIntro?: boolean;
  showSkipOutro?: boolean;
  onSkipIntro?: () => void;
  onSkipOutro?: () => void;
}

/**
 * PlayerControls — YouTube-style overlay.
 *
 * TOP ROW    : ⌄ (minimize)              CC  ⚙  ⋮
 * CENTER     :    ⏮   ▶/⏸   ⏭
 * BOTTOM ROW : time  [progress]  time  ⛶
 */
export function PlayerControls({
  visible,
  isFullscreen,
  onMinimize,
  onFullscreen,
  onSettings,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  showSkipIntro = false,
  showSkipOutro = false,
  onSkipIntro,
  onSkipOutro,
}: PlayerControlsProps) {
  const player = usePlayer();
  const { playing, currentTime, duration, muted, volume, videoRef } = player;

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, [videoRef]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, [videoRef]);

  const volumeIcon = muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊";

  return (
    <div
      className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-150 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={!visible}
    >
      {/* Gradient overlays */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />

      {/* ── TOP ROW ───────────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between px-3 pt-2">
        {/* Minimize / collapse button */}
        <button
          id="player-minimize-btn"
          onClick={onMinimize}
          aria-label="Minimize player"
          className="ctrl-btn"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Right-side controls */}
        <div className="flex items-center gap-1">
          {/* CC (subtitles) */}
          <button
            id="player-cc-btn"
            aria-label="Subtitles"
            className="ctrl-btn text-xs font-bold tracking-tight"
          >
            CC
          </button>

          {/* Settings */}
          <button
            id="player-settings-btn"
            onClick={onSettings}
            aria-label="Settings"
            className="ctrl-btn"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {/* Mute toggle */}
          <button
            id="player-mute-btn"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className="ctrl-btn text-base"
          >
            {volumeIcon}
          </button>
        </div>
      </div>

      {/* ── CENTER ROW ────────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-center gap-8">
        {/* Prev episode */}
        {hasPrev && (
          <button
            id="player-prev-btn"
            onClick={onPrev}
            aria-label="Previous episode"
            className="ctrl-btn-lg"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>
        )}

        {/* Play / Pause */}
        <button
          id="player-playpause-btn"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white transition hover:bg-white/20 active:scale-95"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Next episode */}
        {hasNext && (
          <button
            id="player-next-btn"
            onClick={onNext}
            aria-label="Next episode"
            className="ctrl-btn-lg"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 4V8l-5.5 4zM16 6h2v12h-2z" />
            </svg>
          </button>
        )}
      </div>

      {/* ── BOTTOM ROW ────────────────────────────────────────────────── */}
      <div className="relative z-10 px-3 pb-2">
        {/* Skip Intro / Outro */}
        {(showSkipIntro || showSkipOutro) && (
          <div className="mb-2 flex justify-end">
            <button
              id={showSkipIntro ? "player-skip-intro-btn" : "player-skip-outro-btn"}
              onClick={showSkipIntro ? onSkipIntro : onSkipOutro}
              className="rounded-full border border-white/40 bg-black/60 px-4 py-1.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-[var(--brand-accent)] hover:text-[var(--brand-accent-text)]"
            >
              {showSkipIntro ? "Skip Intro ⏭" : "Skip Outro ⏭"}
            </button>
          </div>
        )}

        {/* Progress bar + times */}
        <div className="group/controls">
          <ProgressBar />
        </div>

        <div className="flex items-center justify-between pt-0.5 text-xs">
          <span className="font-mono tabular-nums text-white/80">
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>

          {/* Fullscreen */}
          <button
            id="player-fullscreen-btn"
            onClick={onFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="ctrl-btn"
          >
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

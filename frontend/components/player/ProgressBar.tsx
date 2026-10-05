"use client";

import { useCallback, useRef, useState } from "react";
import { usePlayer } from "@/lib/playerContext";

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const sec = Math.floor(s % 60);
  const min = Math.floor((s / 60) % 60);
  const hr = Math.floor(s / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return hr > 0 ? `${hr}:${pad(min)}:${pad(sec)}` : `${min}:${pad(sec)}`;
}

interface ProgressBarProps {
  buffered?: number; // 0–1 fraction buffered
}

/**
 * ProgressBar — three-layer seek bar (buffered, played, thumb).
 * - Thin (3px) at rest, grows to 6px + thumb on touch/hover.
 * - Hit area is always 44px tall.
 * - Shows time bubble above thumb while scrubbing.
 */
export function ProgressBar({ buffered = 0 }: ProgressBarProps) {
  const player = usePlayer();
  const { currentTime, duration, videoRef } = player;
  const [active, setActive] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [bubbleX, setBubbleX] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const getTimeFromEvent = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track || !duration) return 0;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return pct * duration;
    },
    [duration]
  );

  const getXPct = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track) return 0;
      const rect = track.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    },
    []
  );

  const handleSeek = useCallback(
    (t: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = t;
      player.setCurrentTime(t);
    },
    [videoRef, player]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive(true);
    const t = getTimeFromEvent(e.clientX);
    const xPct = getXPct(e.clientX);
    setScrubTime(t);
    setBubbleX(xPct * 100);
    handleSeek(t);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return;
    const t = getTimeFromEvent(e.clientX);
    const xPct = getXPct(e.clientX);
    setScrubTime(t);
    setBubbleX(xPct * 100);
    handleSeek(t);
  };

  const onPointerUp = () => {
    setActive(false);
    setScrubTime(null);
  };

  const played = duration > 0 ? (currentTime / duration) * 100 : 0;
  const buf = Math.max(0, Math.min(100, buffered * 100));
  const displayTime = scrubTime !== null ? scrubTime : currentTime;

  return (
    <div className="relative w-full select-none">
      {/* Time bubble while scrubbing */}
      {active && scrubTime !== null && (
        <div
          className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-md bg-black/80 px-2 py-0.5 font-mono text-[11px] font-bold text-white backdrop-blur-sm whitespace-nowrap"
          style={{ left: `${bubbleX}%` }}
        >
          {fmtTime(displayTime)}
        </div>
      )}

      {/* 44px tall hit area */}
      <div
        ref={trackRef}
        className="flex h-[44px] w-full cursor-pointer items-center"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="slider"
        aria-label="Seek"
        aria-valuenow={Math.round(currentTime)}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuetext={`${fmtTime(currentTime)} of ${fmtTime(duration)}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") handleSeek(Math.max(0, currentTime - 5));
          if (e.key === "ArrowRight") handleSeek(Math.min(duration, currentTime + 5));
        }}
      >
        {/* Visual track */}
        <div
          className={`relative w-full overflow-visible rounded-full bg-white/25 transition-all duration-150 ${
            active ? "h-[6px]" : "h-[3px]"
          }`}
        >
          {/* Buffered layer */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/40"
            style={{ width: `${buf}%` }}
          />
          {/* Played layer */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--brand-accent)]"
            style={{ width: `${played}%` }}
          />
          {/* Thumb dot */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow-md transition-all duration-150 ${
              active ? "h-4 w-4" : "h-3 w-3 opacity-0 group-hover/controls:opacity-100"
            }`}
            style={{ left: `${played}%` }}
          />
        </div>
      </div>
    </div>
  );
}

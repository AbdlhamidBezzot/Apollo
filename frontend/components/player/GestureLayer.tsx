"use client";

import { useCallback, useRef } from "react";
import { SeekRipple } from "@/components/player/SeekRipple";
import { usePlayer } from "@/lib/playerContext";
import { useState } from "react";

interface GestureLayerProps {
  onToggleControls: () => void;
  onSwipeDown?: () => void;
}

const DOUBLE_TAP_MS = 300;
const SWIPE_THRESHOLD_Y = 80;
const SWIPE_THRESHOLD_X = 40;
const SEEK_SECONDS = 10;

/**
 * GestureLayer — transparent div covering the full player area.
 * Handles:
 *  - Single tap → toggle controls
 *  - Double-tap left 33% → seek -10s
 *  - Double-tap right 33% → seek +10s
 *  - Multiple quick taps → accumulate seek (20s, 30s…)
 *  - Swipe down → mini player
 */
export function GestureLayer({ onToggleControls, onSwipeDown }: GestureLayerProps) {
  const player = usePlayer();
  const { videoRef } = player;

  const lastTapRef = useRef<{ time: number; x: number; zone: "left" | "right" | "center" } | null>(null);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<number>(0);

  // For swipe detection
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Ripple state
  const [ripple, setRipple] = useState<{ direction: "backward" | "forward" | null; seconds: number; key: number }>({
    direction: null,
    seconds: 0,
    key: 0,
  });

  const triggerSeek = useCallback(
    (delta: number, zone: "left" | "right") => {
      const video = videoRef.current;
      if (!video) return;
      const next = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
      video.currentTime = next;
      player.setCurrentTime(next);
      setRipple((r) => ({
        direction: zone === "left" ? "backward" : "forward",
        seconds: Math.abs(delta),
        key: r.key + 1,
      }));
    },
    [videoRef, player]
  );

  const getZone = (clientX: number, width: number): "left" | "right" | "center" => {
    const pct = clientX / width;
    if (pct < 0.33) return "left";
    if (pct > 0.67) return "right";
    return "center";
  };

  const handleTap = useCallback(
    (clientX: number, width: number) => {
      const zone = getZone(clientX, width);
      const now = Date.now();
      const last = lastTapRef.current;

      const isDoubleTap =
        last &&
        now - last.time < DOUBLE_TAP_MS &&
        last.zone === zone &&
        zone !== "center";

      if (isDoubleTap) {
        // Accumulate seek count
        tapCountRef.current += 1;
        window.clearTimeout(tapTimerRef.current);
        const doubleTapZone = zone as "left" | "right";
        const delta = tapCountRef.current * SEEK_SECONDS * (doubleTapZone === "left" ? -1 : 1);

        tapTimerRef.current = window.setTimeout(() => {
          tapCountRef.current = 0;
        }, DOUBLE_TAP_MS);

        triggerSeek(delta, doubleTapZone);
        lastTapRef.current = { time: now, x: clientX, zone };
      } else {
        // Single tap — reset accumulator
        tapCountRef.current = 1;
        lastTapRef.current = { time: now, x: clientX, zone };

        window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = window.setTimeout(() => {
          // Committed single tap
          tapCountRef.current = 0;
          lastTapRef.current = null;
          onToggleControls();
        }, DOUBLE_TAP_MS);
      }
    },
    [triggerSeek, onToggleControls]
  );

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    if (!start) return;
    touchStartRef.current = null;

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    // Swipe down → mini player
    if (dy > SWIPE_THRESHOLD_Y && Math.abs(dx) < SWIPE_THRESHOLD_X) {
      onSwipeDown?.();
      return;
    }

    // Otherwise treat as tap
    const target = e.currentTarget;
    handleTap(t.clientX, target.getBoundingClientRect().width);
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Desktop fallback — only fires if not a touch event
    handleTap(e.clientX, e.currentTarget.getBoundingClientRect().width);
  };

  return (
    <div
      id="gesture-layer"
      className="absolute inset-0 z-20 touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
      aria-hidden="true"
    >
      {/* Seek ripples (left zone) */}
      {ripple.direction === "backward" && (
        <SeekRipple
          key={`bwd-${ripple.key}`}
          direction="backward"
          seconds={ripple.seconds}
        />
      )}
      {/* Seek ripples (right zone) */}
      {ripple.direction === "forward" && (
        <SeekRipple
          key={`fwd-${ripple.key}`}
          direction="forward"
          seconds={ripple.seconds}
        />
      )}
    </div>
  );
}

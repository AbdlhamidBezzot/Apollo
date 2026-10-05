"use client";

import { useEffect, useState } from "react";

interface SeekRippleProps {
  direction: "backward" | "forward" | null;
  seconds: number;
}

/**
 * SeekRipple — YouTube-style double-tap seek animation.
 * Shows "« 10s" or "10s »" with a ripple flash.
 */
export function SeekRipple({ direction, seconds }: SeekRippleProps) {
  const [visible, setVisible] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!direction) return;
    setVisible(true);
    setKey((k) => k + 1);
    const t = setTimeout(() => setVisible(false), 700);
    return () => clearTimeout(t);
  }, [direction, seconds]);

  if (!visible || !direction) return null;

  return (
    <div
      key={key}
      className={`pointer-events-none absolute inset-y-0 flex w-1/3 items-center justify-center
        ${direction === "backward" ? "left-0" : "right-0"}`}
      aria-hidden="true"
    >
      {/* Ripple circle */}
      <div className="seek-ripple absolute inset-0 rounded-[50%] bg-white/10" />
      {/* Label */}
      <div className="seek-ripple relative flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-0.5 text-white text-xl font-bold drop-shadow-lg">
          {direction === "backward" ? (
            <>
              <span>«</span>
              <span className="text-base">{seconds}s</span>
            </>
          ) : (
            <>
              <span className="text-base">{seconds}s</span>
              <span>»</span>
            </>
          )}
        </div>
        <div className="flex gap-0.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-0.5 w-3 rounded-full bg-white/60"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

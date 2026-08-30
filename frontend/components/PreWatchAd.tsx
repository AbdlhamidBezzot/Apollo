"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AdBanner } from "@/components/AdBanner";

interface PreWatchAdProps {
  title?: string;
  poster?: string | null;
  onComplete: () => void;
  initialCountdown?: number; // total seconds (default 10)
}

export function PreWatchAd({
  title,
  poster,
  onComplete,
  initialCountdown = 10,
}: PreWatchAdProps) {
  const [timeLeft, setTimeLeft] = useState(initialCountdown);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    completedRef.current = false;
    const endsAt = Date.now() + initialCountdown * 1000;

    const complete = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      onCompleteRef.current();
    };
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) complete();
    };

    tick();
    const timer = window.setInterval(tick, 250);
    window.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("visibilitychange", tick);
    };
  }, [initialCountdown]);

  return (
    <div className="relative flex min-h-[85vh] flex-col items-center justify-center px-4 py-8 text-center">
      {/* Background Poster Overlay with Blur */}
      {poster && (
        <div className="absolute inset-0 -z-10 overflow-hidden opacity-20 filter blur-3xl">
          <Image
            src={poster}
            alt="Backdrop"
            fill
            className="object-cover"
            priority
          />
        </div>
      )}

      <div className="w-full max-w-3xl space-y-6 rounded-3xl border border-white/15 bg-bg-card/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        {/* Top Progress & Title Header */}
        <div className="flex flex-col items-center justify-between gap-4 border-b border-white/10 pb-5 sm:flex-row">
          <div className="flex items-center gap-3 text-left">
            {poster && (
              <div className="relative h-14 w-10 overflow-hidden rounded-lg border border-white/10 bg-black/40">
                <Image
                  src={poster}
                  alt={title || "Poster"}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wider text-brand-soft">
                Upcoming Stream
              </p>
              <h2 className="text-lg font-bold text-text-vivid sm:text-xl">
                {title || "Selected Title"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-4 py-2 text-xs font-semibold text-text-muted">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/30 text-brand-soft">
              {timeLeft}
            </span>
            <span>Ad ends in {timeLeft}s</span>
          </div>
        </div>

        {/* Ad Banner Container */}
        <div className="my-4">
          <AdBanner
            unit="banner300x250"
            label="SPONSORED PRE-ROLL AD"
            className="my-0 max-w-full"
          />
        </div>

        {/* Footer info bar */}
        <div className="flex flex-col items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs text-text-muted sm:flex-row">
          <span>Your stream will play automatically in {timeLeft} seconds</span>
          <span className="text-[11px] text-text-muted/60">
            Ads help support legal streaming on Apollo
          </span>
        </div>
      </div>
    </div>
  );
}

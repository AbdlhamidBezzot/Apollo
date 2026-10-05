"use client";

import { useEffect, useState } from "react";

interface NextEpisodeCardProps {
  isVisible: boolean;
  countdown: number;
  seasonNum: number;
  episodeNum: number;
  episodeName?: string;
  thumbnail?: string | null;
  onPlayNow: () => void;
  onCancel: () => void;
}

/**
 * NextEpisodeCard — appears 15-20s before the end of a TV episode.
 * Shows a countdown and "Play now" / "Cancel" buttons.
 */
export function NextEpisodeCard({
  isVisible,
  countdown,
  seasonNum,
  episodeNum,
  episodeName,
  thumbnail,
  onPlayNow,
  onCancel,
}: NextEpisodeCardProps) {
  if (!isVisible) return null;

  return (
    <div
      id="next-episode-card"
      className="animate-rise absolute bottom-20 right-4 z-30 w-64 overflow-hidden rounded-2xl border border-white/15 bg-[#09090b]/90 shadow-2xl backdrop-blur-lg sm:w-72"
    >
      {/* Thumbnail */}
      {thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnail} alt="" className="aspect-video w-full object-cover opacity-70" />
      )}

      <div className="p-3.5">
        {/* Label */}
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--brand-accent)]">
          Up Next in {countdown}s
        </p>
        <p className="mt-0.5 text-xs font-bold text-white">
          S{String(seasonNum).padStart(2, "0")} E{String(episodeNum).padStart(2, "0")}
          {episodeName ? ` — ${episodeName}` : ""}
        </p>

        {/* Countdown progress */}
        <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-[var(--brand-accent)] transition-all duration-1000 ease-linear"
            style={{ width: `${((10 - countdown) / 10) * 100}%` }}
          />
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <button
            id="next-ep-play-now"
            onClick={onPlayNow}
            className="flex-1 rounded-full bg-[var(--brand-accent)] py-2 text-xs font-bold text-[var(--brand-accent-text)] shadow-brand-glow transition hover:bg-[var(--brand-accent-hover)]"
          >
            ▶ Play now
          </button>
          <button
            id="next-ep-cancel"
            onClick={onCancel}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { posterUrl, releaseYear, titleName } from "@/lib/api";
import type { Title } from "@/lib/types";

export function MobileMovieCard({
  item,
  rank,
  onRemove,
}: {
  item: Title;
  rank?: number;
  onRemove?: (item: Title) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const mediaType = item.media_type === "tv" ? "tv" : "movie";
  const href = mediaType === "tv" ? `/tv/${item.id}` : `/movie/${item.id}`;
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
  const year = releaseYear(item);

  return (
    <div className="flex shrink-0 items-end group">
      {rank !== undefined && (
        <span
          aria-hidden="true"
          className="-mr-3 mb-[-6px] select-none text-[90px] font-black leading-none text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.3)]"
        >
          {rank}
        </span>
      )}
      <Link
        href={href}
        className="relative flex w-[124px] sm:w-[150px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#09090B]/80 transition-all active:scale-95 shadow-md"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#121215]">
          <Image
            src={imgError ? "/placeholder-poster.svg" : posterUrl(item.poster_path, "w342")}
            alt={titleName(item)}
            fill
            sizes="150px"
            onError={() => setImgError(true)}
            className="object-cover transition-transform duration-300 group-active:scale-105"
          />

          {/* Vignette overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

          {/* Rating Badge */}
          {rating ? (
            <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-white/15 bg-black/75 px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--brand-accent)] backdrop-blur-md shadow-md">
              <span className="text-[var(--brand-accent)]">★</span> {rating}
            </div>
          ) : (
            <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/60 px-2 py-0.5 font-mono text-[9px] uppercase font-bold text-white/80 backdrop-blur-md">
              {mediaType}
            </div>
          )}

          {/* Optional Remove Button */}
          {onRemove && (
            <button
              type="button"
              aria-label={`Remove ${titleName(item)} from list`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove(item);
              }}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/80 text-xs text-white backdrop-blur active:scale-90"
            >
              ✕
            </button>
          )}

          {/* Play Icon Indicator */}
          <div className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-accent-text)] shadow-brand-glow opacity-95">
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4" aria-hidden="true">
              <path d="M7 5l12 7-12 7V5z" />
            </svg>
          </div>
        </div>

        {/* Title & Metadata below poster */}
        <div className="p-2 bg-[#09090B] space-y-0.5">
          <p className="truncate text-xs font-bold text-white leading-tight">
            {titleName(item)}
          </p>
          <div className="flex items-center justify-between text-[10px] text-white/60">
            <span>{year || (mediaType === "tv" ? "TV" : "Movie")}</span>
            <span className="uppercase text-[9px] font-bold px-1 rounded bg-white/10 text-white/80">
              {mediaType}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

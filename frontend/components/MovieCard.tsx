"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { backdropUrl, posterUrl, releaseYear, titleName } from "@/lib/api";
import type { Title } from "@/lib/types";

export function MovieCard({ item, onRemove }: { item: Title; onRemove?: (item: Title) => void }) {
  const [hovered, setHovered] = useState(false);
  const mediaType = item.media_type === "tv" ? "tv" : "movie";
  const href = item.media_type === "tv" ? `/tv/${item.id}` : `/movie/${item.id}`;
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="card-lift group relative z-0 w-36 shrink-0 overflow-hidden rounded-2xl bg-bg-card hover:z-10 sm:w-44"
      title={titleName(item)}
    >
      <div className="relative aspect-[2/3]">
        {/* Poster (fades out on hover) */}
        <Image
          src={posterUrl(item.poster_path)}
          alt={`${titleName(item)} poster`}
          fill

          sizes="(max-width: 640px) 144px, 176px"
          className={`object-cover transition-all duration-500 ease-out ${
            hovered ? "scale-110 opacity-0" : "scale-100 opacity-100"
          }`}
        />

        {/* Cinematic backdrop preview on hover */}
        {hovered && item.backdrop_path && (
          <Image
            src={backdropUrl(item.backdrop_path, "w500")}
            alt=""
            fill
            sizes="(max-width: 640px) 144px, 176px"
            className="animate-fade-in object-cover"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-bg-void/95 via-bg-void/20 to-transparent" />

        {/* Play overlay */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            hovered ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-brand-glow-lg transition-transform duration-300 group-hover:scale-110">
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5" aria-hidden="true">
              <path d="M7 5l12 7-12 7V5z" />
            </svg>
          </span>
        </div>

        {/* Rating badge */}
        <div className="glass flex items-center gap-1 absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-badge-rating">
          {rating ? (
            <>
              <svg className="h-3 w-3 fill-yellow-400 text-yellow-400" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              {rating}
            </>
          ) : mediaType === "tv" ? "TV" : "MOVIE"}
        </div>

        {/* Remove from list */}
        {onRemove && (
          <button
            type="button"
            aria-label={`Remove ${titleName(item)} from your list`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove(item);
            }}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-xs text-white backdrop-blur transition hover:bg-brand hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute inset-x-0 bottom-0 p-2">
        <p
          className={`truncate text-sm font-semibold text-text-vivid transition-all duration-300 ${
            hovered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          {titleName(item)}
        </p>
        <p
          className={`text-xs text-text-muted transition-all duration-300 ${
            hovered ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          {releaseYear(item)}
        </p>
      </div>
    </Link>
  );
}
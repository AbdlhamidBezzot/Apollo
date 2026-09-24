"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { backdropUrl, releaseYear, titleName } from "@/lib/api";
import { post, del, get } from "@/lib/http";
import type { Title } from "@/lib/types";

export function MobileHero({ slides }: { slides: Title[] }) {
  const [index, setIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const count = slides.length;
  const item = slides[index] || slides[0];

  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % count);
      setImgError(false);
    }, 6000);
    return () => clearInterval(timer);
  }, [count]);

  const mediaType = item?.media_type === "tv" ? "tv" : "movie";
  const year = item ? releaseYear(item) : "";
  const rating = item?.vote_average ? item.vote_average.toFixed(1) : null;
  const watchHref = item ? `/watch/${mediaType}/${item.id}` : "/";
  const detailHref = item ? `/${mediaType}/${item.id}` : "/";

  useEffect(() => {
    if (!item) return;
    let active = true;
    get<{ tmdb_id: number; media_type: string }[]>("/api/v1/me/watchlist")
      .then((list) => {
        if (active && Array.isArray(list)) {
          setIsSaved(list.some((w) => w.tmdb_id === item.id && w.media_type === mediaType));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [item, mediaType]);

  const toggleWatchlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!item) return;
    try {
      if (isSaved) {
        await del(`/api/v1/me/watchlist/${mediaType}/${item.id}`);
        setIsSaved(false);
      } else {
        await post("/api/v1/me/watchlist", { tmdb_id: item.id, media_type: mediaType });
        setIsSaved(true);
      }
    } catch {
      /* ignore auth errors */
    }
  };

  if (!item) return null;

  return (
    <section className="relative w-full h-[55vh] min-h-[360px] max-h-[500px] overflow-hidden bg-[#09090B] flex flex-col justify-end">
      {/* Backdrop Image */}
      <Image
        key={item.id}
        src={imgError ? "/placeholder-backdrop.svg" : backdropUrl(item.backdrop_path, "w1280")}
        alt={titleName(item)}
        fill
        priority
        sizes="100vw"
        onError={() => setImgError(true)}
        className="object-cover object-center w-full h-full animate-fade-in"
      />

      {/* Cinematic dark gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/50 to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#09090B]/80 via-transparent to-transparent z-10" />

      {/* Hero Content */}
      <div className="relative z-20 px-4 pb-6 space-y-3">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/20 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--brand-accent)]">
            {mediaType === "tv" ? "TV Series" : "Featured Movie"}
          </span>
          {rating && (
            <span className="flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2.5 py-0.5 font-mono text-[10px] font-bold text-white backdrop-blur-md">
              <span className="text-[var(--brand-accent)]">★</span> {rating}
            </span>
          )}
          {year && (
            <span className="rounded-full border border-white/10 bg-black/60 px-2.5 py-0.5 font-mono text-[10px] text-white/80 backdrop-blur-md">
              {year}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-black uppercase tracking-tight text-white drop-shadow-lg leading-tight line-clamp-2">
          {titleName(item)}
        </h1>

        {/* Overview snippet */}
        {item.overview && (
          <p className="text-xs text-white/80 line-clamp-2 drop-shadow-md">
            {item.overview}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-1">
          <Link
            href={watchHref}
            className="flex-1 flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--brand-accent)] font-bold text-[var(--brand-accent-text)] shadow-brand-glow text-sm transition active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M7 5l12 7-12 7V5z" />
            </svg>
            Watch Now
          </Link>

          <button
            type="button"
            onClick={toggleWatchlist}
            aria-label={isSaved ? "Remove from Watchlist" : "Add to Watchlist"}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-95 backdrop-blur-md ${
              isSaved
                ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/20 text-[var(--brand-accent)]"
                : "border-white/20 bg-black/60 text-white"
            }`}
          >
            <svg className="h-5 w-5" fill={isSaved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>

          <Link
            href={detailHref}
            aria-label="View title details"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur-md transition active:scale-95"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Slide Indicators */}
      {count > 1 && (
        <div className="absolute bottom-2 right-4 z-20 flex gap-1">
          {slides.slice(0, 5).map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1 rounded-full transition-all ${
                i === index ? "w-5 bg-[var(--brand-accent)]" : "w-2 bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

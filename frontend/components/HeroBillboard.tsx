"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { backdropUrl, posterUrl, releaseYear, titleName } from "@/lib/api";
import { get } from "@/lib/http";
import type { Genre, Title, TitleDetail } from "@/lib/types";

const SLIDE_MS = 6000;

export function HeroBillboard({ slides }: { slides: Title[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [castOpen, setCastOpen] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [detail, setDetail] = useState<TitleDetail | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    get<{ genres: Genre[] }>("/api/v1/content/genres", 86400)
      .then((d) => setGenres(d.genres || []))
      .catch(() => {});
  }, []);

  const count = slides.length;
  const go = (i: number) => setIndex(((i % count) + count) % count);

  useEffect(() => {
    if (count <= 1 || paused) return;
    timerRef.current = window.setInterval(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [count, paused]);

  const item = slides[index];
  const genreNames = useMemo(() => {
    const map = new Map(genres.map((g) => [g.id, g.name]));
    return (item.genre_ids || []).slice(0, 3).map((id) => map.get(id)).filter(Boolean) as string[];
  }, [genres, item]);

  const isSeries = item.media_type === "tv";
  const href = isSeries ? `/tv/${item.id}` : `/movie/${item.id}`;
  const watchHref = `/watch/${isSeries ? "tv" : "movie"}/${item.id}`;

  const ratingScore = item.vote_average ? item.vote_average : 7.0;
  const percentage = (ratingScore * 10).toFixed(1);
  const starsCount = Math.min(5, Math.max(1, Math.round(ratingScore / 2)));

  const loadDetail = async () => {
    if (detail) return;
    try {
      const d = await get<TitleDetail>(`/api/v1/content/${isSeries ? "tv" : "movie"}/${item.id}`);
      setDetail(d);
    } catch {
      setDetail({ id: item.id, poster_path: null, backdrop_path: null });
    }
  };

  const cast = detail?.credits?.cast?.slice(0, 6) || [];
  const director = detail?.credits?.crew?.find((c) => c.job === "Director")?.name;
  const trailerKey = detail?.videos?.results?.find((v) => v.site === "YouTube" && v.type === "Trailer")?.key;
  const shownTitle = titleName(item);

  return (
    <section
      className="relative mx-auto mt-4 h-[580px] w-full max-w-7xl overflow-hidden rounded-3xl border border-white/[0.08] bg-[#09090B]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background Image */}
      <Image
        key={index}
        src={backdropUrl(item.backdrop_path)}
        alt={titleName(item)}
        fill
        priority
        sizes="100vw"
        className="hero-fade object-cover object-center"
      />

      {/* CinemaOS precise gradients for pristine white text contrast on the left */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/85 via-50% to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/30 to-transparent z-10" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#09090B] to-transparent z-10" />

      {/* Main Hero Content */}
      <div className="relative z-20 mx-auto flex h-full max-w-7xl items-center px-6 pt-12 pb-16 lg:px-12">
        <div className="max-w-xl sm:max-w-2xl">
          {/* CinemaOS Title */}
          <h1 className="mb-3 text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-7xl drop-shadow-lg leading-[1.05]">
            {shownTitle}
          </h1>

          {/* CinemaOS 5-Star Rating & Percentage Row */}
          <div className="mb-4 flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <svg
                  key={s}
                  className={`h-4 w-4 ${
                    s <= starsCount ? "fill-[#FACC15] text-[#FACC15]" : "fill-white/20 text-white/20"
                  }`}
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <span className="font-semibold text-sm text-white drop-shadow-sm ml-1">
              {percentage}%
            </span>

            {releaseYear(item) && (
              <span className="ml-2 font-mono text-xs text-white/70">
                · {releaseYear(item)}
              </span>
            )}

            {genreNames.length > 0 && (
              <span className="hidden sm:inline-block ml-2 text-xs text-white/70">
                · {genreNames.join(", ")}
              </span>
            )}
          </div>

          {/* Overview / Description in PURE BRIGHT WHITE */}
          <p className="mb-6 max-w-xl text-sm font-medium leading-relaxed text-white sm:text-base line-clamp-3 sm:line-clamp-4 drop-shadow-md">
            {item.overview || "A hapless medical courier fights for his life amid an outbreak of a deadly mutagenic virus in an isolated mountain town."}
          </p>

          {/* CinemaOS Control Buttons */}
          <div className="flex items-center gap-3">
            {/* White Solid Pill Play Button */}
            <Link
              href={watchHref}
              className="group flex h-11 items-center gap-2 rounded-full bg-white px-7 font-bold text-black transition-all hover:bg-white/90 hover:scale-[1.02] active:scale-95 shadow-xl"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path d="M7 5l12 7-12 7V5z" />
              </svg>
              <span className="text-sm">Play</span>
            </Link>

            {/* Bookmark Circle Button */}
            <button
              onClick={() => {
                loadDetail();
                setCastOpen(true);
              }}
              aria-label="Add to Bookmark"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 hover:border-white/30 hover:scale-105 active:scale-95"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>

            {/* Info Circle Button */}
            <Link
              href={href}
              aria-label="View Details"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 hover:border-white/30 hover:scale-105 active:scale-95"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* CinemaOS Right Vertical Slide Indicator */}
      {count > 1 && (
        <div className="absolute right-6 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-center gap-2 sm:flex">
          <div className="flex h-36 w-1.5 flex-col justify-between rounded-full bg-white/10 p-0.5 backdrop-blur-md">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                aria-label={`Slide ${i + 1}`}
                className={`w-full rounded-full transition-all ${
                  i === index ? "h-8 bg-white" : "h-2 bg-white/30 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Slide selector dock */}
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-4 z-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="flex items-end gap-2">
              <button
                onClick={() => go(index - 1)}
                aria-label="Previous slide"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-text-muted backdrop-blur-md transition hover:text-white hover:border-white/40"
              >
                ‹
              </button>
              {slides.map((s, i) => (
                <button
                  key={`${s.media_type}-${s.id}`}
                  onClick={() => go(i)}
                  aria-label={`Go to ${titleName(s)}`}
                  aria-current={i === index}
                  className={`group relative flex-1 overflow-hidden rounded-xl border transition ${
                    i === index ? "border-[#FACC15]" : "border-white/10 opacity-50 hover:opacity-100"
                  }`}
                >
                  <div className="relative aspect-[21/9] w-full sm:aspect-video">
                    <Image
                      src={backdropUrl(s.backdrop_path, "w500")}
                      alt=""
                      fill
                      sizes="200px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090B]/90 to-transparent" />
                    <span className="absolute bottom-1 left-2 truncate pr-2 font-mono text-[10px] font-bold text-white">
                      {String(i + 1).padStart(2, "0")} · {titleName(s)}
                    </span>
                    {i === index && (
                      <span className="hero-progress absolute bottom-0 left-0 h-0.5 bg-[#FACC15]" aria-hidden="true" />
                    )}
                  </div>
                </button>
              ))}
              <button
                onClick={() => go(index + 1)}
                aria-label="Next slide"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-text-muted backdrop-blur-md transition hover:text-text-vivid"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}

      {trailerOpen && trailerKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setTrailerOpen(false)} />
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-black shadow-glass">
            <button
              onClick={() => setTrailerOpen(false)}
              aria-label="Close trailer"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              ✕
            </button>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1`}
              title="Trailer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="aspect-video w-full"
            />
          </div>
        </div>
      )}

      {castOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setCastOpen(false)} />
          <div className="glass animate-rise relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-bg-void/95 p-6 shadow-glass">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-lg font-bold text-text-vivid">Cast & Crew</h3>
                <p className="text-xs text-text-muted">{shownTitle}</p>
              </div>
              <button
                onClick={() => setCastOpen(false)}
                aria-label="Close cast modal"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-vivid"
              >
                ✕
              </button>
            </div>

            {cast.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-muted">Loading cast details…</div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {cast.map((c) => (
                    <div key={c.id} className="flex flex-col items-center rounded-2xl border border-white/5 bg-white/5 p-3 text-center transition hover:bg-white/10">
                      <div className="relative mb-2 h-16 w-16 overflow-hidden rounded-full border border-white/10 bg-bg-card">
                        {c.profile_path ? (
                          <Image
                            src={posterUrl(c.profile_path, "w185")}
                            alt={c.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-bold text-text-muted">
                            {c.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <p className="w-full truncate text-xs font-bold text-text-vivid">{c.name}</p>
                      <p className="w-full truncate text-[11px] text-text-muted">{c.character || "Cast"}</p>
                    </div>
                  ))}
                </div>
                {director && (
                  <div className="mt-4 border-t border-white/10 pt-3 text-center text-xs text-text-muted">
                    Director · <span className="font-semibold text-text-vivid">{director}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
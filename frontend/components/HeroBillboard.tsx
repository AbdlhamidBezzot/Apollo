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

  const match = Math.max(62, Math.min(98, Math.round(((item.vote_average || 7) * 10) * 0.98)));
  const isSeries = item.media_type === "tv";
  const href = isSeries ? `/tv/${item.id}` : `/movie/${item.id}`;
  const watchHref = `/watch/${isSeries ? "tv" : "movie"}/${item.id}`;

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
      className="relative mx-auto mt-4 h-[560px] w-full max-w-7xl overflow-hidden rounded-3xl border border-white/[0.08] bg-[#09090B]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Image
        key={index}
        src={backdropUrl(item.backdrop_path)}
        alt={titleName(item)}
        fill
        priority
        sizes="100vw"
        className="hero-fade object-cover"
      />
      {/* Dark atmospheric Cinemaos gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#09090B]/90 via-[#09090B]/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#09090B] to-transparent" />

      <div className="relative mx-auto flex h-full max-w-7xl items-end px-6 pb-20 lg:px-10">
        <div className="max-w-2xl">
          {/* Metadata pill row */}
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-[#10B981]/15 px-3 py-0.5 font-bold text-[#10B981] border border-[#10B981]/30">
              {match}% Match
            </span>
            {item.vote_average ? (
              <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-0.5 font-bold text-[#FACC15] border border-white/10 backdrop-blur-md">
                <svg className="h-3 w-3 fill-[#FACC15] text-[#FACC15]" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                {item.vote_average.toFixed(1)}
              </span>
            ) : null}
            {releaseYear(item) && <span className="font-mono text-text-muted">{releaseYear(item)}</span>}
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 font-mono text-[11px] uppercase tracking-wider text-text-muted backdrop-blur-md">
              {isSeries ? "Series" : "4K HDR"}
            </span>
            {genreNames.map((g) => (
              <span key={g} className="rounded-full border border-white/10 px-3 py-0.5 text-xs text-text-muted">
                {g}
              </span>
            ))}
          </div>

          {/* Cinemaos Headline Display 80px / Weight 900 */}
          <h1 className="mb-4 text-4xl font-black tracking-tight leading-none text-[#FAFAFA] sm:text-5xl lg:text-7xl">
            {shownTitle}
          </h1>

          {/* Brief Overview */}
          <p className="mb-6 max-w-xl text-sm leading-relaxed text-[#A1A1AA] line-clamp-2 sm:text-base">
            {item.overview}
          </p>

          {/* Cinemaos Pill Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={watchHref}
              className="cinema-btn-gold min-h-[44px] gap-2 font-bold shadow-brand-glow"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path d="M7 5l12 7-12 7V5z" />
              </svg>
              Play Now
            </Link>
            <Link
              href={href}
              className="cinema-btn-pill min-h-[44px] font-semibold"
            >
              Details
            </Link>
          </div>
        </div>
      </div>

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
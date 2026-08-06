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
      className="relative mx-auto mt-6 h-[520px] w-full max-w-7xl overflow-hidden rounded-3xl border border-white/10 shadow-card-hover"
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
      <div className="absolute inset-0 bg-gradient-to-t from-bg-void via-bg-void/40 to-transparent" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 30% 100%, rgba(255,10,71,0.18), transparent 60%)" }}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg-void to-transparent" />

      <div className="relative mx-auto flex h-full max-w-7xl items-end px-4 pb-16 lg:px-8">
        <div className="max-w-2xl">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-accent-emerald/90 px-2 py-0.5 font-bold text-black">{match}% Match</span>
            {item.vote_average ? (
              <span className="glass rounded-md px-2 py-0.5 font-bold text-badge-rating">★ {item.vote_average.toFixed(1)}</span>
            ) : null}
            {releaseYear(item) && <span className="font-mono text-text-muted">{releaseYear(item)}</span>}
            <span className="glass rounded-md px-2 py-0.5 font-mono text-[11px] uppercase text-text-muted">
              {isSeries ? "Series" : "4K HDR"}
            </span>
          </div>

          <h1 className="mb-3 text-4xl font-extrabold leading-[1.1] tracking-tightest text-text-vivid sm:text-6xl">
            {shownTitle}
          </h1>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            {genreNames.map((g) => (
              <span key={g} className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-text-muted">
                {g}
              </span>
            ))}
          </div>

          <p className="mb-6 max-w-xl text-sm leading-relaxed text-text-muted line-clamp-3">{item.overview}</p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={watchHref}
              className="flex items-center gap-2 rounded-full bg-brand px-7 py-2.5 text-sm font-bold text-white shadow-brand-glow-lg transition hover:bg-brand-soft"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path d="M7 5l12 7-12 7V5z" />
              </svg>
              Play Now
            </Link>
            <Link
              href={href}
              className="glass rounded-full px-7 py-2.5 text-sm font-semibold text-text-vivid transition hover:bg-white/10"
            >
              Details
            </Link>
            <button
              onClick={() => {
                loadDetail();
                setTrailerOpen(true);
              }}
              disabled={!trailerKey && !castOpen}
              className="glass rounded-full px-5 py-2.5 text-sm font-semibold text-text-vivid transition hover:bg-white/10 disabled:opacity-50"
            >
              🎬 Trailer
            </button>
            <button
              onClick={() => {
                loadDetail();
                setCastOpen(true);
              }}
              className="glass rounded-full px-5 py-2.5 text-sm font-semibold text-text-vivid transition hover:bg-white/10"
            >
              🎭 Cast
            </button>
          </div>
        </div>
      </div>

      {/* Slide selector dock */}
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-0 z-20">
          <div className="mx-auto max-w-7xl px-4 pb-2 lg:px-8">
            <div className="flex items-end gap-2">
              <button
                onClick={() => go(index - 1)}
                aria-label="Previous slide"
                className="glass flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:text-text-vivid"
              >
                ‹
              </button>
              {slides.map((s, i) => (
                <button
                  key={`${s.media_type}-${s.id}`}
                  onClick={() => go(i)}
                  aria-label={`Go to ${titleName(s)}`}
                  aria-current={i === index}
                  className={`group relative flex-1 overflow-hidden rounded-lg border transition ${
                    i === index ? "border-brand/60" : "border-white/10 opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="relative aspect-video w-full">
                    <Image
                      src={backdropUrl(s.backdrop_path, "w500")}
                      alt=""
                      fill
                      sizes="200px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg-void/90 to-transparent" />
                    <span className="absolute bottom-1 left-2 truncate pr-2 font-mono text-[10px] text-text-vivid">
                      {String(i + 1).padStart(2, "0")} · {titleName(s)}
                    </span>
                    {i === index && (
                      <span className="hero-progress absolute bottom-0 left-0 h-0.5 bg-brand" aria-hidden="true" />
                    )}
                  </div>
                </button>
              ))}
              <button
                onClick={() => go(index + 1)}
                aria-label="Next slide"
                className="glass flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:text-text-vivid"
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
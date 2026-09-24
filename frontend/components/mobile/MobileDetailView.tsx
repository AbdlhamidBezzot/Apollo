"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MobileMovieCarousel } from "./MobileMovieCarousel";
import { backdropUrl, posterUrl, releaseYear, titleName } from "@/lib/api";
import { del, get, post } from "@/lib/http";
import type { Title, TitleDetail } from "@/lib/types";

interface Episode {
  id: number;
  name: string;
  episode_number: number;
  still_path?: string | null;
  runtime?: number | null;
  overview?: string | null;
}

export function MobileDetailView({
  item,
  similar,
  mediaType,
}: {
  item: TitleDetail;
  similar: Title[];
  mediaType: "movie" | "tv";
}) {
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(false);
  const [season, setSeason] = useState(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const year = releaseYear(item);
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
  const genres = (item.genres || []).map((g) => g.name).join(" • ");
  const runtime = item.runtime ? `${item.runtime} min` : "";
  const cast = (item.credits?.cast || []).slice(0, 10);
  const number_of_seasons = item.number_of_seasons || 1;
  const seasons = Array.from({ length: Math.max(number_of_seasons, 1) }, (_, i) => i + 1);

  useEffect(() => {
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
  }, [item.id, mediaType]);

  useEffect(() => {
    if (mediaType !== "tv") return;
    let active = true;
    setLoadingEpisodes(true);
    get<{ episodes?: Episode[] }>(`/api/v1/content/tv/${item.id}/season/${season}`)
      .then((res) => {
        if (active) setEpisodes(res.episodes || []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingEpisodes(false);
      });
    return () => {
      active = false;
    };
  }, [mediaType, item.id, season]);

  const toggleWatchlist = async () => {
    try {
      if (isSaved) {
        await del(`/api/v1/me/watchlist/${mediaType}/${item.id}`);
        setIsSaved(false);
      } else {
        await post("/api/v1/me/watchlist", { tmdb_id: item.id, media_type: mediaType });
        setIsSaved(true);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] pb-24 text-white">
      {/* Top Floating Back & Bookmark Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+8px)] pb-3 pointer-events-none">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white backdrop-blur-md active:scale-90"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={toggleWatchlist}
          aria-label={isSaved ? "Remove from watchlist" : "Add to watchlist"}
          className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md active:scale-90 ${
            isSaved
              ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-[var(--brand-accent-text)]"
              : "border-white/20 bg-black/60 text-white"
          }`}
        >
          <svg className="h-5 w-5" fill={isSaved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      </div>

      {/* Hero Backdrop Header */}
      <section className="relative h-[340px] w-full overflow-hidden bg-[#09090B]">
        <Image
          src={backdropUrl(item.backdrop_path, "w1280")}
          alt={titleName(item)}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#09090B] to-transparent" />
      </section>

      {/* Title Header Info */}
      <div className="relative px-4 -mt-28 space-y-4">
        {/* Poster & Main Specs Row */}
        <div className="flex gap-4 items-end">
          <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-[#121215] shadow-2xl">
            <Image
              src={posterUrl(item.poster_path, "w342")}
              alt={titleName(item)}
              fill
              priority
              sizes="112px"
              className="object-cover"
            />
          </div>

          <div className="flex-1 space-y-1.5 pb-1">
            <span className="inline-block rounded-full border border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/20 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[var(--brand-accent)]">
              {mediaType === "tv" ? "TV Series" : "Movie"}
            </span>

            <h1 className="text-xl font-black uppercase tracking-tight text-white leading-snug line-clamp-2">
              {titleName(item)}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-xs text-white/70 font-mono">
              {rating && (
                <span className="flex items-center gap-1 font-bold text-[var(--brand-accent)]">
                  ★ {rating}
                </span>
              )}
              {year && <span>· {year}</span>}
              {runtime && <span>· {runtime}</span>}
              {mediaType === "tv" && number_of_seasons > 0 && (
                <span>· {number_of_seasons} S</span>
              )}
            </div>
          </div>
        </div>

        {/* Play Now CTA */}
        <Link
          href={`/watch/${mediaType}/${item.id}`}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-accent)] text-[var(--brand-accent-text)] font-extrabold text-sm shadow-brand-glow transition active:scale-98"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M7 5l12 7-12 7V5z" />
          </svg>
          Watch Now
        </Link>

        {/* Genres */}
        {genres && (
          <p className="text-xs font-semibold text-[var(--brand-accent)] tracking-wide">
            {genres}
          </p>
        )}

        {/* Overview */}
        <div className="space-y-1 pt-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white/50">Overview</h2>
          <p className="text-xs leading-relaxed text-white/90">
            {item.overview || "No synopsis available for this title."}
          </p>
        </div>

        {/* TV Season & Episode Picker */}
        {mediaType === "tv" && (
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">Episodes</h2>
              <select
                value={season}
                onChange={(e) => setSeason(Number(e.target.value))}
                className="rounded-full border border-white/20 bg-[#121215] px-3.5 py-1 text-xs font-bold text-white outline-none"
              >
                {seasons.map((s) => (
                  <option key={s} value={s}>
                    Season {s}
                  </option>
                ))}
              </select>
            </div>

            {loadingEpisodes ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-white/10 animate-pulse" />
                ))}
              </div>
            ) : episodes.length === 0 ? (
              <p className="text-xs text-white/60">No episodes found for this season.</p>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto no-scrollbar">
                {episodes.map((ep) => (
                  <Link
                    key={ep.id}
                    href={`/watch/tv/${item.id}?season=${season}&episode=${ep.episode_number}`}
                    className="flex gap-3 items-center rounded-xl border border-white/10 bg-white/5 p-2 transition active:bg-white/10"
                  >
                    <div className="relative aspect-video w-24 shrink-0 rounded-lg overflow-hidden bg-[#121215]">
                      <Image
                        src={backdropUrl(ep.still_path ?? null, "w300")}
                        alt={ep.name}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-accent-text)]">
                          <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="truncate text-xs font-bold text-white">
                        E{ep.episode_number}. {ep.name}
                      </p>
                      {ep.overview && (
                        <p className="line-clamp-2 text-[10px] text-white/60 leading-tight">
                          {ep.overview}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cast Carousel */}
        {cast.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-white/10">
            <h2 className="text-sm font-black uppercase tracking-wider text-white">Cast</h2>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
              {cast.map((c) => (
                <div key={c.id} className="w-20 shrink-0 text-center snap-start space-y-1">
                  <div className="relative h-16 w-16 mx-auto rounded-full overflow-hidden border border-white/15 bg-[#121215]">
                    {c.profile_path ? (
                      <Image
                        src={posterUrl(c.profile_path, "w185")}
                        alt={c.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white/50">
                        {c.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="truncate text-[11px] font-semibold text-white">{c.name}</p>
                  <p className="truncate text-[9px] text-white/50">{c.character}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Similar Titles */}
        {similar.length > 0 && (
          <div className="pt-4 border-t border-white/10">
            <MobileMovieCarousel title="More Like This" items={similar} />
          </div>
        )}
      </div>
    </div>
  );
}

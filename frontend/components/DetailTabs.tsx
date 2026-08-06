"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MovieRow } from "@/components/MovieRow";
import { backdropUrl, posterUrl } from "@/lib/api";
import { get } from "@/lib/http";
import type { CastMember, Title } from "@/lib/types";

interface EpisodeMeta {
  is_filler: boolean;
  is_canon: boolean;
  arc_name?: string | null;
  audio_languages?: string[];
}

interface Episode {
  id: number;
  name: string;
  episode_number: number;
  still_path?: string | null;
  runtime?: number | null;
  overview?: string | null;
  meta?: EpisodeMeta | null;
}

interface Props {
  mediaType: "movie" | "tv";
  tmdbId: number;
  number_of_seasons?: number;
  trailerKey?: string | null;
  cast: CastMember[];
  similar: Title[];
}

const TABS = ["Episodes", "Trailers & Extras", "Cast & Crew", "Similar"] as const;
type Tab = (typeof TABS)[number];

type AudioPref = "all" | "sub" | "dub";

function metaBadge(meta: EpisodeMeta): { label: string; cls: string } | null {
  if (!meta) return null;
  if (meta.is_filler && meta.is_canon) return { label: "Mixed", cls: "bg-blue-500/20 text-blue-300" };
  if (meta.is_filler) return { label: "Filler", cls: "bg-badge-filler/20 text-badge-filler" };
  if (meta.is_canon) return { label: "Canon", cls: "bg-badge-canon/20 text-badge-canon" };
  return null;
}

export function DetailTabs({ mediaType, tmdbId, number_of_seasons, trailerKey, cast, similar }: Props) {
  const [tab, setTab] = useState<Tab>(mediaType === "tv" ? "Episodes" : "Trailers & Extras");
  const [season, setSeason] = useState(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);
  const [audioPref, setAudioPref] = useState<AudioPref>("all");
  const [hideFiller, setHideFiller] = useState(false);
  const [arc, setArc] = useState<string>("");

  const seasons = Array.from({ length: Math.max(number_of_seasons || 1, 1) }, (_, i) => i + 1);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("apollo:audio-pref");
      if (saved === "sub" || saved === "dub" || saved === "all") setAudioPref(saved);
      setHideFiller(localStorage.getItem("apollo:hide-filler") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (tab !== "Episodes" || mediaType !== "tv") return;
    let cancelled = false;
    setLoading(true);
    setEpisodes([]);
    setArc("");
    get<{ episodes?: Episode[] }>(`/api/v1/content/tv/${tmdbId}/season/${season}`)
      .then((res) => {
        if (!cancelled) setEpisodes(res.episodes || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, mediaType, tmdbId, season]);

  const visibleTabs = TABS.filter((t) => (mediaType === "tv" ? true : t !== "Episodes"));

  const hasAudioMeta = episodes.some((e) => e.meta && (e.meta.audio_languages?.length ?? 0) > 0);
  const hasFillerMeta = episodes.some((e) => e.meta?.is_filler === true);

  const arcs = Array.from(
    new Set(episodes.map((e) => e.meta?.arc_name).filter((a): a is string => Boolean(a)))
  );
  const hasArcs = arcs.length > 0;

  const filtered = episodes.filter((ep) => {
    if (audioPref === "sub" && ep.meta && ep.meta.audio_languages?.length && !ep.meta.audio_languages.includes("ja")) {
      return false;
    }
    if (audioPref === "dub" && ep.meta && ep.meta.audio_languages?.length && !ep.meta.audio_languages.includes("en")) {
      return false;
    }
    if (hideFiller && ep.meta?.is_filler === true) return false;
    if (arc && ep.meta?.arc_name !== arc) return false;
    return true;
  });

  const setAudio = (pref: AudioPref) => {
    setAudioPref(pref);
    try {
      localStorage.setItem("apollo:audio-pref", pref);
    } catch {
      /* ignore */
    }
  };

  const toggleFiller = (v: boolean) => {
    setHideFiller(v);
    try {
      localStorage.setItem("apollo:hide-filler", v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mt-10">
      <div role="tablist" aria-label="Content sections" className="flex gap-1 overflow-x-auto border-b border-white/10">
        {visibleTabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`relative whitespace-nowrap px-4 py-2.5 text-sm transition ${
              tab === t ? "font-bold text-text-vivid" : "text-text-muted hover:text-text-vivid"
            }`}
          >
            {t}
            <span
              aria-hidden="true"
              className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand transition-opacity ${
                tab === t ? "opacity-100" : "opacity-0"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="py-6">
        {tab === "Episodes" && mediaType === "tv" && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="text-sm text-text-muted">
                Season
                <select
                  value={season}
                  onChange={(e) => setSeason(Number(e.target.value))}
                  className="ml-2 rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm text-text-vivid focus:border-brand/50"
                >
                  {seasons.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              {hasArcs && (
                <label className="text-sm text-text-muted">
                  Arc
                  <select
                    value={arc}
                    onChange={(e) => setArc(e.target.value)}
                    aria-label="Filter by story arc"
                    className="ml-2 rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm text-text-vivid focus:border-brand/50"
                  >
                    <option value="">All arcs</option>
                    {arcs.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {hasAudioMeta && (
                <div className="flex overflow-hidden rounded-full border border-white/10 text-xs">
                  {(
                    [
                      { value: "all", label: "All audio" },
                      { value: "sub", label: "Sub" },
                      { value: "dub", label: "Dub" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAudio(opt.value)}
                      aria-pressed={audioPref === opt.value}
                      className={`px-3 py-1.5 transition ${
                        audioPref === opt.value ? "bg-brand font-bold text-white" : "text-text-muted hover:text-text-vivid"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {hasFillerMeta && (
                <button
                  onClick={() => toggleFiller(!hideFiller)}
                  aria-pressed={hideFiller}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    hideFiller
                      ? "border-brand bg-brand/15 text-brand-soft"
                      : "border-white/10 text-text-muted hover:border-brand/50"
                  }`}
                >
                  {hideFiller ? "Filler hidden" : "Hide Filler"}
                </button>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton aspect-video rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((ep) => {
                  const badge = ep.meta ? metaBadge(ep.meta) : null;
                  return (
                    <Link
                      key={ep.id}
                      href={`/watch/tv/${tmdbId}?season=${season}&episode=${ep.episode_number}`}
                      className="card-lift group overflow-hidden rounded-2xl border border-white/10 bg-bg-card"
                    >
                      <div className="relative aspect-video overflow-hidden">
                        <Image
                          src={backdropUrl(ep.still_path ?? null)}
                          alt={ep.name || `Episode ${ep.episode_number}`}
                          fill
                          sizes="(max-width: 640px) 100vw, 400px"
                          className="object-cover transition duration-300 group-hover:scale-105"
                        />
                        <span className="glass absolute left-2 top-2 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold text-text-vivid">
                          E{ep.episode_number}
                        </span>
                        {ep.runtime ? (
                          <span className="glass absolute right-2 top-2 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-text-muted">
                            {ep.runtime}m
                          </span>
                        ) : null}
                        {badge && (
                          <span className={`absolute bottom-2 right-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-white/0 opacity-0 transition duration-300 group-hover:bg-black/30 group-hover:opacity-100">
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-brand-glow">
                            ▶
                          </span>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-semibold text-text-vivid">
                          {ep.episode_number}. {ep.name || `Episode ${ep.episode_number}`}
                        </p>
                        {ep.meta?.arc_name ? (
                          <p className="mt-0.5 text-[11px] font-semibold text-brand-soft">{ep.meta.arc_name}</p>
                        ) : null}
                        {ep.overview ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-muted">{ep.overview}</p>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
                {!loading && filtered.length === 0 && (
                  <p className="text-text-muted">No episodes match the current filters.</p>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "Trailers & Extras" && (
          <div>
            {trailerKey ? (
              <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-black shadow-glass">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${trailerKey}`}
                  title="Trailer"
                  allowFullScreen
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  className="aspect-video w-full"
                />
              </div>
            ) : (
              <p className="text-text-muted">No trailer available for this title.</p>
            )}
          </div>
        )}

        {tab === "Cast & Crew" && (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {cast.length ? (
              cast.map((c) => (
                <div key={c.id} className="w-24 shrink-0 text-center">
                  <div className="mx-auto mb-2 h-24 w-24 overflow-hidden rounded-full bg-bg-card ring-2 ring-white/10">
                    {c.profile_path ? (
                      <Image
                        src={posterUrl(c.profile_path, "w185")}
                        alt={c.name}
                        width={96}
                        height={96}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-text-muted">
                        {c.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="truncate text-xs font-medium text-text-vivid">{c.name}</p>
                  <p className="truncate text-xs text-text-muted">{c.character}</p>
                </div>
              ))
            ) : (
              <p className="text-text-muted">No cast information available.</p>
            )}
          </div>
        )}

        {tab === "Similar" &&
          (similar.length ? <MovieRow title="You might also like" items={similar} /> : <p className="text-text-muted">No similar titles found.</p>)}
      </div>
    </div>
  );
}
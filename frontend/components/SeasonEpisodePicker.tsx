"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { get } from "@/lib/http";

interface Episode {
  id: number;
  name: string;
  episode_number: number;
  still_path?: string | null;
  runtime?: number | null;
  overview?: string | null;
}

interface Props {
  tmdbId: number;
  number_of_seasons?: number;
}

export function SeasonEpisodePicker({ tmdbId, number_of_seasons }: Props) {
  const seasons = Array.from({ length: Math.max(number_of_seasons || 1, 1) }, (_, i) => i + 1);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEpisode(1);
    setEpisodes([]);
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
  }, [tmdbId, season]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm text-text-muted">
        Season
        <select
          value={season}
          onChange={(e) => setSeason(Number(e.target.value))}
          className="ml-2 rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm text-text-vivid focus:border-brand/50 focus:outline-none"
        >
          {seasons.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-text-muted">
        Episode
        <select
          value={episode}
          onChange={(e) => setEpisode(Number(e.target.value))}
          disabled={loading || episodes.length === 0}
          className="ml-2 rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm text-text-vivid focus:border-brand/50 focus:outline-none disabled:opacity-50"
        >
          {loading ? (
            <option>Loading…</option>
          ) : (
            episodes.map((ep) => (
              <option key={ep.id} value={ep.episode_number}>
                {ep.episode_number}. {ep.name || `Episode ${ep.episode_number}`}
              </option>
            ))
          )}
        </select>
      </label>
      <Link
        href={`/watch/tv/${tmdbId}?season=${season}&episode=${episode}`}
        className="rounded-full bg-brand px-6 py-2 text-sm font-bold text-white shadow-brand-glow transition hover:bg-brand-soft"
      >
        ▶ Play
      </Link>
    </div>
  );
}

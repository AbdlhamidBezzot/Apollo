"use client";

import { useEffect, useState } from "react";
import { AdBanner } from "@/components/AdBanner";
import { AnimeHubPrefs } from "@/components/AnimeHubPrefs";
import { FeedErrorState } from "@/components/FeedErrorState";
import { MovieRow } from "@/components/MovieRow";
import { API_URL } from "@/lib/api";
import { classifyError, logTechnicalDetail, type ApiIssue } from "@/lib/errors";
import { checkBackendHealth } from "@/lib/health";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

export function AnimeClient() {
  const [loading, setLoading] = useState(true);
  const [issue, setIssue] = useState<ApiIssue | null>(null);
  const [movies, setMovies] = useState<Title[]>([]);
  const [series, setSeries] = useState<Title[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadAnimeData() {
      // 1. Verify backend health at runtime
      const health = await checkBackendHealth(API_URL);
      if (cancelled) return;

      if (!health.ok) {
        const healthIssue =
          health.issueCode === "timeout"
            ? classifyError(new Error("Request timed out"))
            : classifyError(new TypeError("Failed to fetch"));
        logTechnicalDetail(healthIssue, `health check failed (${health.issueCode})`);
        setIssue(healthIssue);
        setLoading(false);
        return;
      }

      // 2. Fetch anime discovery lists
      async function fetchAnime(mediaType: "movie" | "tv"): Promise<{ items: Title[]; failed: boolean }> {
        try {
          const data = await get<ContentListResponse>(
            `/api/v1/content/discover?media_type=${mediaType}&genre=16&sort_by=popularity.desc`
          );
          return {
            items: (data.results || []).map((t) => ({ ...t, media_type: mediaType })),
            failed: false,
          };
        } catch (err) {
          const errIssue = classifyError(err);
          logTechnicalDetail(errIssue, mediaType);
          return { items: [], failed: true };
        }
      }

      const [resMovies, resSeries] = await Promise.all([fetchAnime("movie"), fetchAnime("tv")]);
      if (cancelled) return;

      if (!resMovies.items.length && !resSeries.items.length) {
        const failIssue = classifyError(new Error("Anime catalog failed"));
        logTechnicalDetail(failIssue, "Anime discovery lists returned empty/502");
        setIssue(failIssue);
      } else {
        setMovies(resMovies.items);
        setSeries(resSeries.items);
      }
      setLoading(false);
    }

    loadAnimeData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (issue) {
    return <FeedErrorState issue={issue} />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-brand-soft">Discover</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tightest text-text-vivid">Anime</h1>
      </div>
      <AnimeHubPrefs />

      {loading ? (
        <div className="space-y-12 animate-pulse">
          <div className="space-y-4">
            <div className="h-6 w-40 rounded bg-white/10" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-xl bg-surface-dark" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-6 w-40 rounded bg-white/10" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-xl bg-surface-dark" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <MovieRow title="Anime movies" items={movies} seeAllHref="/browse?media_type=movie&genre=16" />
          <AdBanner unit="leaderboard728x90" />
          <MovieRow title="Anime series" items={series} seeAllHref="/browse?media_type=tv&genre=16" />
        </>
      )}
    </div>
  );
}

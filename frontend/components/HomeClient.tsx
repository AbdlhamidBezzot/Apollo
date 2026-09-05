"use client";

import { useEffect, useState } from "react";
import { AdBanner } from "@/components/AdBanner";
import { ContinueWatchingRow } from "@/components/ContinueWatchingRow";
import { FeedErrorState } from "@/components/FeedErrorState";
import { HeroBillboard } from "@/components/HeroBillboard";
import { DiscoveryHub, EditorsPickSpotlight, FeaturedEditorialSection, HomeIntroBanner, ProviderMarquee, Top10Carousel } from "@/components/HomeEnhancements";
import { MovieRow } from "@/components/MovieRow";
import { RecommendationsRow } from "@/components/RecommendationsRow";
import { SignInNotice } from "@/components/SignInNotice";
import { API_URL } from "@/lib/api";
import { classifyError, logTechnicalDetail, type ApiIssue } from "@/lib/errors";
import { checkBackendHealth } from "@/lib/health";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

export function HomeClient() {
  const [loading, setLoading] = useState(true);
  const [issue, setIssue] = useState<ApiIssue | null>(null);

  const [trending, setTrending] = useState<Title[]>([]);
  const [topStreaming, setTopStreaming] = useState<Title[]>([]);
  const [popularMovies, setPopularMovies] = useState<Title[]>([]);
  const [popularTv, setPopularTv] = useState<Title[]>([]);
  const [topRated, setTopRated] = useState<Title[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
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

      // 2. Fetch catalog lists
      async function fetchList(path: string): Promise<{ items: Title[]; failed: boolean }> {
        try {
          const data = await get<ContentListResponse>(path, 1800);
          return {
            items: (data.results || []).map((t) => ({ ...t, media_type: t.media_type || "movie" })),
            failed: false,
          };
        } catch (err) {
          const errIssue = classifyError(err);
          logTechnicalDetail(errIssue, path);
          return { items: [], failed: true };
        }
      }

      const [resTrending, resTopStreaming, resPopularMovies, resPopularTv, resTopRated] =
        await Promise.all([
          fetchList("/api/v1/content/trending?time_window=week"),
          fetchList("/api/v1/content/top-streaming?media_type=movie"),
          fetchList("/api/v1/content/popular?media_type=movie"),
          fetchList("/api/v1/content/popular?media_type=tv"),
          fetchList("/api/v1/content/top-rated?media_type=movie"),
        ]);

      if (cancelled) return;

      const rows = [
        { title: "Trending this week", items: resTrending.items },
        { title: "Popular movies", items: resPopularMovies.items },
        { title: "Popular series", items: resPopularTv.items },
        { title: "Top rated", items: resTopRated.items },
      ];

      const totalItems = rows.reduce((sum, r) => sum + r.items.length, 0);
      const allFailed = rows.every((r) => r.items.length === 0) && totalItems === 0;

      if (allFailed) {
        const failIssue = classifyError(new Error("Content service failed"));
        logTechnicalDetail(failIssue, "All home lists returned empty/502");
        setIssue(failIssue);
      } else {
        setTrending(resTrending.items);
        setTopStreaming(resTopStreaming.items);
        setPopularMovies(resPopularMovies.items);
        setPopularTv(resPopularTv.items);
        setTopRated(resTopRated.items);
      }
      setLoading(false);
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (issue) {
    return <FeedErrorState issue={issue} />;
  }

  if (loading) {
    return (
      <div className="space-y-12 pb-4 animate-pulse">
        {/* Billboard Skeleton */}
        <div className="relative aspect-[21/9] w-full overflow-hidden rounded-3xl bg-surface-dark border border-white/5" />
        {/* Intro Skeleton */}
        <div className="h-24 w-full rounded-2xl bg-surface-dark/50" />
        {/* Row Skeletons */}
        <div className="space-y-4">
          <div className="h-6 w-48 rounded bg-white/10" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-surface-dark" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const rows = [
    { title: "Trending this week", items: trending, seeAllHref: "/browse?kind=trending" },
    { title: "Popular movies", items: popularMovies, seeAllHref: "/browse?media_type=movie&sort_by=popularity.desc" },
    { title: "Popular series", items: popularTv, seeAllHref: "/browse?media_type=tv&sort_by=popularity.desc" },
    { title: "Top rated", items: topRated, seeAllHref: "/browse?media_type=movie&sort_by=vote_average.desc" },
  ];

  return (
    <div className="space-y-12 pb-4">
      {trending.length > 0 && <HeroBillboard slides={trending} />}

      <ContinueWatchingRow />

      <HomeIntroBanner />

      <Top10Carousel items={topStreaming.length ? topStreaming : trending} />

      <EditorsPickSpotlight />

      <DiscoveryHub />
      <ProviderMarquee />
      <SignInNotice />

      <FeaturedEditorialSection />

      <AdBanner unit="leaderboard728x90" />

      <RecommendationsRow />

      {rows.map((row, idx) => (
        <div key={row.title} className="space-y-12">
          <MovieRow title={row.title} items={row.items} seeAllHref={row.seeAllHref} />
          {idx === 1 && <AdBanner unit="leaderboard728x90" />}
        </div>
      ))}
    </div>
  );
}

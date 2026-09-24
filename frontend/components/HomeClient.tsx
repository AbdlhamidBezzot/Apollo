"use client";

import { useCallback, useEffect, useState } from "react";

import { Ad300x250 } from "@/components/Ad300x250";
import { ContinueWatchingRow } from "@/components/ContinueWatchingRow";
import { HeroBillboard } from "@/components/HeroBillboard";
import {
  DiscoveryHub,
  EditorsPickSpotlight,
  FeaturedEditorialSection,
  GenreBrowseHub,
  ProviderMarquee,
  Top10Carousel,
  TopRatedHub,
} from "@/components/HomeEnhancements";
import { MovieRow } from "@/components/MovieRow";
import { RecommendationsRow } from "@/components/RecommendationsRow";
import { SignInNotice } from "@/components/SignInNotice";
import { MobileHomeView } from "@/components/mobile/MobileHomeView";
import { useIsMobile } from "@/lib/useIsMobile";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function HomeClient() {
  const { isMobile, mounted } = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trending, setTrending] = useState<Title[]>([]);
  const [topStreaming, setTopStreaming] = useState<Title[]>([]);
  const [popularMovies, setPopularMovies] = useState<Title[]>([]);
  const [popularTv, setPopularTv] = useState<Title[]>([]);
  const [topRated, setTopRated] = useState<Title[]>([]);

  const loadData = useCallback(async (isRetry = false) => {
    if (isRetry) {
      setRetrying(true);
    } else {
      setLoading(true);
    }
    setError(null);

    async function fetchListWithRetry(path: string, attempts = 2): Promise<Title[]> {
      for (let i = 0; i < attempts; i++) {
        try {
          const data = await get<ContentListResponse>(path, 1800);
          if (data && Array.isArray(data.results)) {
            return data.results.map((t) => ({ ...t, media_type: t.media_type || "movie" }));
          }
        } catch {
          if (i < attempts - 1) {
            await sleep(1500);
          }
        }
      }
      return [];
    }

    try {
      const [resTrending, resTopStreaming, resPopularMovies, resPopularTv, resTopRated] =
        await Promise.all([
          fetchListWithRetry("/api/v1/content/trending?time_window=week"),
          fetchListWithRetry("/api/v1/content/top-streaming?media_type=movie"),
          fetchListWithRetry("/api/v1/content/popular?media_type=movie"),
          fetchListWithRetry("/api/v1/content/popular?media_type=tv"),
          fetchListWithRetry("/api/v1/content/top-rated?media_type=movie"),
        ]);

      setTrending(resTrending);
      setTopStreaming(resTopStreaming);
      setPopularMovies(resPopularMovies);
      setPopularTv(resPopularTv);
      setTopRated(resTopRated);

      const totalItems =
        resTrending.length +
        resTopStreaming.length +
        resPopularMovies.length +
        resPopularTv.length +
        resTopRated.length;

      if (totalItems === 0) {
        setError("Stream catalog server is warming up.");
      }
    } catch {
      setError("Unable to reach stream server.");
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hasAnyItems = trending.length > 0 || popularMovies.length > 0 || popularTv.length > 0 || topRated.length > 0;

  if (mounted && isMobile) {
    return <MobileHomeView />;
  }

  return (
    <div className="space-y-[64px] sm:space-y-[80px] pb-12">
      {/* 1. Hero Billboard Banner */}
      {trending.length > 0 ? (
        <HeroBillboard slides={trending} />
      ) : loading ? (
        <section className="relative w-full min-h-[80vh] -mt-16 pt-20 pb-16 flex items-end overflow-hidden bg-[#121215] px-6 lg:px-12">
          <div className="max-w-2xl space-y-4">
            <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">Find your next great watch.</h1>
            <p className="max-w-lg text-sm leading-relaxed text-zinc-300 sm:text-base">Browse movies and series across the streaming services you already use.</p>
            <div className="h-12 w-36 animate-pulse rounded-full bg-white/15" aria-label="Loading featured title" />
          </div>
        </section>
      ) : null}

      {/* 2. Continue Watching Carousel */}
      <ContinueWatchingRow />

      {/* 3. TOP 10 Movies Carousel */}
      {popularMovies.length > 0 || trending.length > 0 ? (
        <Top10Carousel
          title="TOP 10 Movies"
          items={popularMovies.length ? popularMovies : trending}
          seeAllHref="/browse?media_type=movie&sort_by=popularity.desc"
        />
      ) : null}

      {/* 4. TOP 10 Shows Carousel */}
      {popularTv.length > 0 || trending.length > 0 ? (
        <Top10Carousel
          title="TOP 10 Shows"
          items={popularTv.length ? popularTv : trending}
          seeAllHref="/browse?media_type=tv&sort_by=popularity.desc"
        />
      ) : null}

      {/* 5. Streaming Providers Hub */}
      <DiscoveryHub />

      <Ad300x250 />

      {/* 6. Top Rated Hub */}
      <TopRatedHub />

      {/* 7. Browse by Genre Hub */}
      <GenreBrowseHub />

      <SignInNotice />

      {/* Additional Curated Rows */}
      {trending.length > 0 && (
        <MovieRow title="Trending This Week" items={trending} seeAllHref="/browse?kind=trending" />
      )}

      <ProviderMarquee />
      <EditorsPickSpotlight />
      <FeaturedEditorialSection />

      <RecommendationsRow />

      <Ad300x250 />

      {!loading && !hasAnyItems && error && (
        <div className="mx-auto max-w-xl rounded-2xl border border-white/20 bg-white/5 p-6 text-center shadow-glass backdrop-blur-xl">
          <p className="text-sm font-bold text-white">Backend Service Notice</p>
          <p className="mt-1 text-xs text-text-muted">
            The backend stream catalog API is currently warming up from a cold start. Click below to refresh content.
          </p>
          <button
            onClick={() => loadData(true)}
            disabled={retrying}
            className="mt-4 cinema-btn-accent font-bold shadow-xl"
          >
            {retrying ? "Connecting…" : "Refresh Stream Catalog 🔄"}
          </button>
        </div>
      )}
    </div>
  );
}

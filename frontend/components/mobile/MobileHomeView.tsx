"use client";

import { useCallback, useEffect, useState } from "react";
import { MobileHero } from "./MobileHero";
import { MobileMovieCarousel } from "./MobileMovieCarousel";
import { MobileHeroSkeleton, MobileCarouselSkeleton } from "./MobileSkeleton";
import { ContinueWatchingRow } from "@/components/ContinueWatchingRow";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function MobileHomeView() {
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trending, setTrending] = useState<Title[]>([]);
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
      const [resTrending, resPopularMovies, resPopularTv, resTopRated] =
        await Promise.all([
          fetchListWithRetry("/api/v1/content/trending?time_window=week"),
          fetchListWithRetry("/api/v1/content/popular?media_type=movie"),
          fetchListWithRetry("/api/v1/content/popular?media_type=tv"),
          fetchListWithRetry("/api/v1/content/top-rated?media_type=movie"),
        ]);

      setTrending(resTrending);
      setPopularMovies(resPopularMovies);
      setPopularTv(resPopularTv);
      setTopRated(resTopRated);

      const totalItems =
        resTrending.length +
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

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-[#09090B]">
      {/* 1. Hero Section */}
      {loading ? (
        <MobileHeroSkeleton />
      ) : trending.length > 0 ? (
        <MobileHero slides={trending} />
      ) : null}

      {/* 2. Continue Watching */}
      <div className="px-1 py-1">
        <ContinueWatchingRow />
      </div>

      {/* 3. Top 10 Movies */}
      {popularMovies.length > 0 && (
        <MobileMovieCarousel
          title="TOP 10 Movies"
          items={popularMovies}
          isTop10
          seeAllHref="/browse?media_type=movie&sort_by=popularity.desc"
        />
      )}

      {/* 4. Top 10 TV Shows */}
      {popularTv.length > 0 && (
        <MobileMovieCarousel
          title="TOP 10 Shows"
          items={popularTv}
          isTop10
          seeAllHref="/browse?media_type=tv&sort_by=popularity.desc"
        />
      )}

      {/* 5. Trending This Week */}
      {trending.length > 0 && (
        <MobileMovieCarousel
          title="Trending Movies & TV"
          items={trending}
          seeAllHref="/browse?kind=trending"
        />
      )}

      {/* 6. Popular Movies */}
      {popularMovies.length > 0 && (
        <MobileMovieCarousel
          title="Popular Movies"
          items={popularMovies}
          seeAllHref="/browse?media_type=movie"
        />
      )}

      {/* 7. Top Rated Movies */}
      {topRated.length > 0 && (
        <MobileMovieCarousel
          title="Top Rated Classics"
          items={topRated}
          seeAllHref="/browse?media_type=movie&sort_by=vote_average.desc"
        />
      )}

      {/* 8. Popular TV Shows */}
      {popularTv.length > 0 && (
        <MobileMovieCarousel
          title="Popular TV Series"
          items={popularTv}
          seeAllHref="/browse?media_type=tv"
        />
      )}

      {/* Loading Skeletons */}
      {loading && (
        <>
          <MobileCarouselSkeleton title="Trending Now" />
          <MobileCarouselSkeleton title="Popular Movies" />
          <MobileCarouselSkeleton title="Top Rated" />
        </>
      )}

      {/* Error state */}
      {!loading && !hasAnyItems && error && (
        <div className="mx-4 my-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-lg">
          <p className="text-sm font-bold text-white">Service Notice</p>
          <p className="mt-1 text-xs text-white/70">
            The stream catalog is warming up. Tap below to reload.
          </p>
          <button
            onClick={() => loadData(true)}
            disabled={retrying}
            className="mt-4 cinema-btn-accent text-xs px-5 py-2 font-bold"
          >
            {retrying ? "Connecting..." : "Reload Stream Catalog 🔄"}
          </button>
        </div>
      )}
    </div>
  );
}

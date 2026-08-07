import { ContinueWatchingRow } from "@/components/ContinueWatchingRow";
import { FeedErrorState } from "@/components/FeedErrorState";
import { HeroBillboard } from "@/components/HeroBillboard";
import { MovieRow } from "@/components/MovieRow";
import { DiscoveryHub, ProviderMarquee, Top10Carousel } from "@/components/HomeEnhancements";
import { RecommendationsRow } from "@/components/RecommendationsRow";
import { API_URL } from "@/lib/api";
import { classifyError, logTechnicalDetail } from "@/lib/errors";
import { checkBackendHealth } from "@/lib/health";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

async function fetchList(path: string): Promise<{ items: Title[]; failed: boolean }> {
  try {
    const data = await get<ContentListResponse>(path, 1800);
    return {
      items: (data.results || []).map((t) => ({ ...t, media_type: t.media_type || "movie" })),
      failed: false,
    };
  } catch (err) {
    const issue = classifyError(err);
    logTechnicalDetail(issue, path);
    return { items: [], failed: true };
  }
}

export default async function HomePage() {
  // Verify backend health before attempting to load any content. If the API is
  // unreachable we short-circuit and explain what is wrong instead of showing
  // an empty feed.
  const health = await checkBackendHealth(API_URL);
  if (!health.ok) {
    const issue =
      health.issueCode === "timeout"
        ? classifyError(new Error("Request timed out"))
        : classifyError(new TypeError("Failed to fetch"));
    logTechnicalDetail(issue, `health check failed (${health.issueCode})`);
    return <FeedErrorState issue={issue} />;
  }

  const [trending, topStreaming, popularMovies, popularTv, topRated] = await Promise.all([
    fetchList("/api/v1/content/trending?time_window=week"),
    fetchList("/api/v1/content/top-streaming?media_type=movie"),
    fetchList("/api/v1/content/popular?media_type=movie"),
    fetchList("/api/v1/content/popular?media_type=tv"),
    fetchList("/api/v1/content/top-rated?media_type=movie"),
  ]);

  const rows = [
    { title: "Trending this week", items: trending.items, seeAllHref: "/browse?kind=trending" },
    { title: "Popular movies", items: popularMovies.items, seeAllHref: "/browse?media_type=movie&sort_by=popularity.desc" },
    { title: "Popular series", items: popularTv.items, seeAllHref: "/browse?media_type=tv&sort_by=popularity.desc" },
    { title: "Top rated", items: topRated.items, seeAllHref: "/browse?media_type=movie&sort_by=vote_average.desc" },
  ];

  const totalItems = rows.reduce((sum, r) => sum + r.items.length, 0);
  const allFailed = rows.every((r) => r.items.length === 0) && totalItems === 0;

  if (allFailed) {
    // Backend is healthy but the upstream content service is failing (TMDB).
    return (
      <FeedErrorState
        issue={{
          code: "missing_tmdb",
          title: "Content service unavailable",
          message:
            "Apollo is online but the content service returned no data. Make sure TMDB_API_KEY " +
            "is configured on the deployed backend.",
          detail: "All home lists returned empty/502.",
        }}
      />
    );
  }

  return (
    <div className="space-y-12 pb-4">
      {trending.items.length > 0 && <HeroBillboard slides={trending.items} />}

      <Top10Carousel items={topStreaming.items.length ? topStreaming.items : trending.items} />
      <DiscoveryHub />
      <ProviderMarquee />
      <ContinueWatchingRow />

      <RecommendationsRow />

      {rows.map((row) => (
        <MovieRow key={row.title} title={row.title} items={row.items} seeAllHref={row.seeAllHref} />
      ))}
    </div>
  );
}
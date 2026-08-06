import { ContinueWatchingRow } from "@/components/ContinueWatchingRow";
import { HeroBillboard } from "@/components/HeroBillboard";
import { MovieRow } from "@/components/MovieRow";
import { DiscoveryHub, ProviderMarquee, Top10Carousel } from "@/components/HomeEnhancements";
import { RecommendationsRow } from "@/components/RecommendationsRow";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

async function fetchList(path: string): Promise<Title[]> {
  try {
    const data = await get<ContentListResponse>(path, 1800);
    return (data.results || []).map((t) => ({ ...t, media_type: t.media_type || "movie" }));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [trending, topStreaming, popularMovies, popularTv, topRated] = await Promise.all([
    fetchList("/api/v1/content/trending?time_window=week"),
    fetchList("/api/v1/content/top-streaming?media_type=movie"),
    fetchList("/api/v1/content/popular?media_type=movie"),
    fetchList("/api/v1/content/popular?media_type=tv"),
    fetchList("/api/v1/content/top-rated?media_type=movie"),
  ]);

  const rows = [
    { title: "Trending this week", items: trending, seeAllHref: "/browse?kind=trending" },
    { title: "Popular movies", items: popularMovies, seeAllHref: "/browse?media_type=movie&sort_by=popularity.desc" },
    { title: "Popular series", items: popularTv, seeAllHref: "/browse?media_type=tv&sort_by=popularity.desc" },
    { title: "Top rated", items: topRated, seeAllHref: "/browse?media_type=movie&sort_by=vote_average.desc" },
  ];

  if (trending.length === 0 && !rows.some((r) => r.items.length)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center text-text-muted">
        <h1 className="mb-2 text-2xl font-extrabold text-text-vivid">Welcome to Apollo</h1>
        <p>
          The content feed is unavailable right now. Make sure the backend is running and that{" "}
          <code className="rounded bg-bg-card px-1.5 py-0.5 font-mono text-xs">TMDB_API_KEY</code> is set in{" "}
          <code className="rounded bg-bg-card px-1.5 py-0.5 font-mono text-xs">backend/.env</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-4">
      {trending.length > 0 && <HeroBillboard slides={trending} />}

      <Top10Carousel items={topStreaming.length ? topStreaming : trending} />
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
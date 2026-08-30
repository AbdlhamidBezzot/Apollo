import { AdBanner } from "@/components/AdBanner";
import { AnimeHubPrefs } from "@/components/AnimeHubPrefs";
import { FeedErrorState } from "@/components/FeedErrorState";
import { MovieRow } from "@/components/MovieRow";
import { API_URL } from "@/lib/api";
import { classifyError, logTechnicalDetail } from "@/lib/errors";
import { checkBackendHealth } from "@/lib/health";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

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
    const issue = classifyError(err);
    logTechnicalDetail(issue, mediaType);
    return { items: [], failed: true };
  }
}

export default async function AnimePage() {
  const health = await checkBackendHealth(API_URL);
  if (!health.ok) {
    const issue =
      health.issueCode === "timeout"
        ? classifyError(new Error("Request timed out"))
        : classifyError(new TypeError("Failed to fetch"));
    logTechnicalDetail(issue, `health check failed (${health.issueCode})`);
    return <FeedErrorState issue={issue} />;
  }

  const [movies, series] = await Promise.all([fetchAnime("movie"), fetchAnime("tv")]);

  if (!movies.items.length && !series.items.length) {
    const issue = classifyError(new Error("Anime catalog failed"));
    logTechnicalDetail(issue, "Anime discovery lists returned empty/502");
    return <FeedErrorState issue={issue} />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-brand-soft">Discover</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tightest text-text-vivid">Anime</h1>
      </div>
      <AnimeHubPrefs />
      <MovieRow title="Anime movies" items={movies.items} seeAllHref="/browse?media_type=movie&genre=16" />
      <AdBanner unit="leaderboard728x90" />
      <MovieRow title="Anime series" items={series.items} seeAllHref="/browse?media_type=tv&genre=16" />
    </div>
  );
}
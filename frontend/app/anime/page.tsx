import { AnimeHubPrefs } from "@/components/AnimeHubPrefs";
import { MovieRow } from "@/components/MovieRow";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

async function fetchAnime(mediaType: "movie" | "tv"): Promise<Title[]> {
  try {
    const data = await get<ContentListResponse>(
      `/api/v1/content/discover?media_type=${mediaType}&genre=16&sort_by=popularity.desc`
    );
    return (data.results || []).map((t) => ({ ...t, media_type: mediaType }));
  } catch {
    return [];
  }
}

export default async function AnimePage() {
  const [movies, series] = await Promise.all([fetchAnime("movie"), fetchAnime("tv")]);

  if (!movies.length && !series.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center text-text-muted">
        <h1 className="mb-2 text-2xl font-extrabold text-text-vivid">Anime</h1>
        <p>Anime titles are unavailable right now. Make sure the backend is running and TMDB_API_KEY is set.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-brand-soft">Discover</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tightest text-text-vivid">Anime</h1>
      </div>
      <AnimeHubPrefs />
      <MovieRow title="Anime movies" items={movies} seeAllHref="/browse?media_type=movie&genre=16" />
      <MovieRow title="Anime series" items={series} seeAllHref="/browse?media_type=tv&genre=16" />
    </div>
  );
}

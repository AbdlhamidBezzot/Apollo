import { BrowseClient, type BrowseParams } from "@/components/BrowseClient";
import { get } from "@/lib/http";

interface BrowseProps {
  searchParams: Promise<Partial<Record<keyof BrowseParams, string>>>;
}

export default async function BrowsePage({ searchParams }: BrowseProps) {
  const params = await searchParams;

  let genres: { id: number; name: string }[] = [];
  try {
    const genreResp = await get<{ genres: { id: number; name: string }[] }>("/api/v1/content/genres", 86400);
    genres = genreResp.genres || [];
  } catch {
    /* degraded: genre dropdown shows "All genres" only */
  }

  const initial: Partial<BrowseParams> = {};
  for (const key of ["media_type", "genre", "year", "min_rating", "sort_by", "kind", "language", "country"] as const) {
    if (params[key]) initial[key] = params[key]!;
  }

  return <BrowseClient initial={initial} genres={genres} />;
}

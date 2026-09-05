import type { Metadata } from "next";
import { BrowseClient, type BrowseParams } from "@/components/BrowseClient";
import { get } from "@/lib/http";

export const metadata: Metadata = {
  title: "TV Shows - Apollo",
  description: "Discover trending TV series, top-rated shows, and popular releases on Apollo.",
  alternates: {
    canonical: "https://www.missapollo.me/tv",
  },
  openGraph: {
    title: "TV Shows - Apollo",
    description: "Discover trending TV series, top-rated shows, and popular releases on Apollo.",
    url: "https://www.missapollo.me/tv",
    siteName: "Apollo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TV Shows - Apollo",
    description: "Discover trending TV series, top-rated shows, and popular releases on Apollo.",
  },
};

interface TvPageProps {
  searchParams: Promise<Partial<Record<keyof BrowseParams, string>>>;
}

export default async function TvPage({ searchParams }: TvPageProps) {
  const params = await searchParams;

  let genres: { id: number; name: string }[] = [];
  try {
    const genreResp = await get<{ genres: { id: number; name: string }[] }>("/api/v1/content/genres", 86400);
    genres = genreResp.genres || [];
  } catch {
    /* degraded fallback */
  }

  const initial: Partial<BrowseParams> = { media_type: "tv" };
  for (const key of ["genre", "year", "min_rating", "sort_by", "kind", "language", "country"] as const) {
    if (params[key]) initial[key] = params[key]!;
  }

  return <BrowseClient initial={initial} genres={genres} />;
}

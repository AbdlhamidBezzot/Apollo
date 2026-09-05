import type { Metadata } from "next";
import { BrowseClient, type BrowseParams } from "@/components/BrowseClient";
import { get } from "@/lib/http";

export const metadata: Metadata = {
  title: "Browse Movies & TV Shows - Apollo",
  description: "Browse movies, TV shows, and anime by genre, year, rating, and language on Apollo.",
  alternates: {
    canonical: "https://www.missapollo.me/browse",
  },
  openGraph: {
    title: "Browse Movies & TV Shows - Apollo",
    description: "Browse movies, TV shows, and anime by genre, year, rating, and language on Apollo.",
    url: "https://www.missapollo.me/browse",
    siteName: "Apollo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Browse Movies & TV Shows - Apollo",
    description: "Browse movies, TV shows, and anime by genre, year, rating, and language on Apollo.",
  },
};

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

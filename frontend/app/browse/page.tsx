import type { Metadata } from "next";
import { Suspense } from "react";
import { BrowseWithParams } from "@/components/BrowseWithParams";
import { get } from "@/lib/http";

export const dynamic = "force-static";

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

export default async function BrowsePage() {
  let genres: { id: number; name: string }[] = [];
  try {
    const genreResp = await get<{ genres: { id: number; name: string }[] }>("/api/v1/content/genres", 86400);
    genres = genreResp.genres || [];
  } catch {
    /* degraded fallback */
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="skeleton mb-6 h-10 w-48 rounded" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton aspect-[2/3] rounded-2xl" />
            ))}
          </div>
        </div>
      }
    >
      <BrowseWithParams genres={genres} />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { BrowseWithParams } from "@/components/BrowseWithParams";
import { get } from "@/lib/http";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Movies - Apollo",
  description: "Explore popular, trending, and top-rated movies on Apollo.",
  alternates: {
    canonical: "https://www.missapollo.me/movies",
  },
  openGraph: {
    title: "Movies - Apollo",
    description: "Explore popular, trending, and top-rated movies on Apollo.",
    url: "https://www.missapollo.me/movies",
    siteName: "Apollo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Movies - Apollo",
    description: "Explore popular, trending, and top-rated movies on Apollo.",
  },
};

export default async function MoviesPage() {
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
      <BrowseWithParams defaultMediaType="movie" genres={genres} />
    </Suspense>
  );
}

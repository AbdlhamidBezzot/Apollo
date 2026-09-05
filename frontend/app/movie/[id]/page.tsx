import type { Metadata } from "next";
import { DetailView } from "@/components/DetailView";
import { backdropUrl, posterUrl, releaseYear, titleName } from "@/lib/api";
import { get } from "@/lib/http";
import type { TitleDetail } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) return { title: "Movie Not Found - Apollo", robots: { index: false } };

  try {
    const item = await get<TitleDetail>(`/api/v1/content/movie/${numId}`);
    if (!item || !item.id) return { title: "Movie Not Found - Apollo", robots: { index: false } };

    const name = titleName(item);
    const year = releaseYear(item);
    const titleStr = year ? `${name} (${year}) - Apollo` : `${name} - Apollo`;
    const descStr = (item.overview || `Watch ${name} on Apollo. Discover movies, TV shows, and streaming details.`).slice(0, 200);
    const ogImage = item.backdrop_path
      ? backdropUrl(item.backdrop_path, "w1280")
      : item.poster_path
      ? posterUrl(item.poster_path, "w500")
      : "https://www.missapollo.me/og-image.png";

    const canonicalUrl = `https://www.missapollo.me/movie/${numId}`;

    return {
      title: titleStr,
      description: descStr,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        title: titleStr,
        description: descStr,
        url: canonicalUrl,
        siteName: "Apollo",
        type: "video.movie",
        images: [
          {
            url: ogImage,
            alt: `${name} poster`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: titleStr,
        description: descStr,
        images: [ogImage],
      },
    };
  } catch {
    return {
      title: "Movie - Apollo",
      description: "Discover movies on Apollo.",
    };
  }
}

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DetailView mediaType="movie" id={Number(id)} />;
}

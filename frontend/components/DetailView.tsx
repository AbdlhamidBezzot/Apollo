// Server Component — do NOT add "use client" here.
import { notFound } from "next/navigation";
import { DetailViewClient } from "@/components/DetailViewClient";
import { posterUrl, titleName } from "@/lib/api";
import { get } from "@/lib/http";
import type { ContentListResponse, Title, TitleDetail } from "@/lib/types";

export async function DetailView({ mediaType, id }: { mediaType: "movie" | "tv"; id: number }) {
  let item: TitleDetail | null = null;
  let similar: Title[] = [];

  try {
    const [detail, sim] = await Promise.all([
      get<TitleDetail>(`/api/v1/content/${mediaType}/${id}`),
      get<ContentListResponse>(`/api/v1/content/${mediaType}/${id}/similar`).catch(() => null),
    ]);
    item = detail;
    similar = (sim?.results || []).slice(0, 12).map((t) => ({ ...t, media_type: mediaType }));
  } catch {
    /* fall through */
  }

  if (!item || !item.id) {
    notFound();
  }

  const name = titleName(item);
  const releaseDate = item.release_date || item.first_air_date;
  const poster = item.poster_path ? posterUrl(item.poster_path, "w500") : undefined;
  const genres = item.genres?.map((g) => g.name) || [];

  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": mediaType === "movie" ? "Movie" : "TVSeries",
    name,
    description: item.overview || undefined,
    image: poster ? [poster] : undefined,
    datePublished: releaseDate || undefined,
    genre: genres.length ? genres : undefined,
    ...(item.vote_average && item.vote_count ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: item.vote_average.toFixed(1),
        ratingCount: item.vote_count,
        bestRating: "10",
        worstRating: "1",
      },
    } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
      />
      <DetailViewClient item={item} similar={similar} mediaType={mediaType} />
    </>
  );
}

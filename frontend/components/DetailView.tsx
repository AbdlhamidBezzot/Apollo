"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DetailViewClient } from "@/components/DetailViewClient";
import { MobileDetailSkeleton } from "@/components/mobile/MobileSkeleton";
import { posterUrl, titleName } from "@/lib/api";
import { get } from "@/lib/http";
import type { ContentListResponse, Title, TitleDetail } from "@/lib/types";

export function DetailView({ mediaType, id: propId }: { mediaType: "movie" | "tv"; id?: number }) {
  const params = useParams();
  
  const rawId = (params?.id as string) || String(propId || "");
  const targetId = Number(rawId) || propId || 0;

  const [item, setItem] = useState<TitleDetail | null>(null);
  const [similar, setSimilar] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId || targetId <= 0) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      get<TitleDetail>(`/api/v1/content/${mediaType}/${targetId}`),
      get<ContentListResponse>(`/api/v1/content/${mediaType}/${targetId}/similar`).catch(() => null),
    ])
      .then(([detail, sim]) => {
        if (!active) return;
        if (detail && detail.id) {
          setItem(detail);
          setSimilar((sim?.results || []).slice(0, 12).map((t) => ({ ...t, media_type: mediaType })));
        } else {
          setError("Title not found");
        }
      })
      .catch(() => {
        if (active) setError("Unable to load title details.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mediaType, targetId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] p-4">
        <MobileDetailSkeleton />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center text-white">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-2xl">
          🎬
        </div>
        <h2 className="mb-2 text-xl font-bold text-white">{error || "Title Not Found"}</h2>
        <p className="mb-6 text-xs text-white/60">We couldn&apos;t load the details for this title.</p>
        <button
          onClick={() => window.history.back()}
          className="inline-block cinema-btn-accent px-6 py-2.5 text-xs font-extrabold shadow-brand-glow"
        >
          Go Back
        </button>
      </div>
    );
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
    ...(item.vote_average && item.vote_count
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: item.vote_average.toFixed(1),
            ratingCount: item.vote_count,
            bestRating: "10",
            worstRating: "1",
          },
        }
      : {}),
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

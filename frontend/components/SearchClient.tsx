"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MovieCard } from "@/components/MovieCard";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

export function SearchClient() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const [results, setResults] = useState<Title[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      return;
    }
    setLoading(true);
    get<ContentListResponse>(`/api/v1/content/search?q=${encodeURIComponent(query)}`)
      .then((data) => setResults(data.results || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-text-vivid">
        {q.trim() ? `Results for “${q}”` : "Search"}
      </h1>
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[2/3] rounded-2xl" />
          ))}
        </div>
      ) : q.trim() && !results.length ? (
        <p className="text-text-muted">No results found.</p>
      ) : results.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {results.map((item) => (
            <MovieCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

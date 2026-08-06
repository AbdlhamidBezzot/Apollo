import { MovieCard } from "@/components/MovieCard";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

interface SearchProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchProps) {
  const { q = "" } = await searchParams;
  let results: Title[] = [];

  if (q.trim()) {
    try {
      const data = await get<ContentListResponse>(`/api/v1/content/search?q=${encodeURIComponent(q.trim())}`);
      results = data.results || [];
    } catch {
      /* degraded */
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tightest text-text-vivid">
        {q.trim() ? `Results for “${q}”` : "Search"}
      </h1>
      {q.trim() && !results.length && <p className="text-text-muted">No results found.</p>}
      {results.length ? (
        <div className="flex flex-wrap gap-3">
          {results.map((item) => (
            <MovieCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

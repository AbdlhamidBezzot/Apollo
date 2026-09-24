"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MobileGridSkeleton } from "./MobileSkeleton";
import { posterUrl, releaseYear, titleName } from "@/lib/api";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

export function MobileSearchView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";

  const [q, setQ] = useState(initialQ);
  const [cat, setCat] = useState<"multi" | "movie" | "tv">("multi");
  const [results, setResults] = useState<Title[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let active = true;
    const fetchCat = cat === "multi" ? "" : `&media_type=${cat}`;

    const timer = setTimeout(() => {
      get<ContentListResponse>(`/api/v1/content/search?q=${encodeURIComponent(query)}${fetchCat}`)
        .then((data) => {
          if (active) setResults(data.results || []);
        })
        .catch(() => {
          if (active) setResults([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q, cat]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] pb-24 text-white">
      {/* Top Search Input Header */}
      <div className="sticky top-0 z-30 bg-[#09090B]/95 backdrop-blur-xl border-b border-white/10 pt-[calc(env(safe-area-inset-top)+8px)] pb-3 px-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <svg className="absolute left-3.5 h-4 w-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies & TV shows..."
            className="w-full rounded-full border border-white/15 bg-white/5 pl-10 pr-10 py-2.5 text-xs font-semibold text-white outline-none placeholder:text-white/40 focus:border-[var(--brand-accent)]"
            autoFocus
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-3 text-xs text-white/50 hover:text-white"
            >
              ✕
            </button>
          )}
        </form>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { value: "multi", label: "All Titles" },
            { value: "movie", label: "Movies" },
            { value: "tv", label: "TV Shows" },
          ].map((c) => (
            <button
              key={c.value}
              onClick={() => setCat(c.value as any)}
              className={`rounded-full px-3.5 py-1 text-xs font-bold whitespace-nowrap transition ${
                cat === c.value
                  ? "bg-[var(--brand-accent)] text-[var(--brand-accent-text)] shadow-brand-glow"
                  : "border border-white/10 bg-white/5 text-white/70"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Content */}
      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <MobileGridSkeleton count={9} />
        ) : q.trim().length >= 2 && results.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="text-sm font-bold text-white">No results found</p>
            <p className="text-xs text-white/60">
              We couldn&apos;t find anything matching &quot;{q}&quot;.
            </p>
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {results.map((item) => {
              const mediaType = item.media_type === "tv" ? "tv" : "movie";
              const href = mediaType === "tv" ? `/tv/${item.id}` : `/movie/${item.id}`;
              const rating = item.vote_average ? item.vote_average.toFixed(1) : null;

              return (
                <Link
                  key={`${mediaType}-${item.id}`}
                  href={href}
                  className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#09090B] transition active:scale-95 space-y-1"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#121215] rounded-2xl">
                    <Image
                      src={posterUrl(item.poster_path, "w342")}
                      alt={titleName(item)}
                      fill
                      sizes="120px"
                      className="object-cover"
                    />
                    {rating && (
                      <div className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full border border-white/15 bg-black/80 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[var(--brand-accent)]">
                        ★ {rating}
                      </div>
                    )}
                  </div>
                  <div className="px-1 pb-1 space-y-0.5">
                    <p className="truncate text-[11px] font-bold text-white leading-tight">
                      {titleName(item)}
                    </p>
                    <p className="text-[9px] text-white/50">
                      {releaseYear(item) || mediaType.toUpperCase()}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center space-y-2">
            <span className="text-3xl">🔍</span>
            <p className="text-sm font-bold text-white">Search Apollo</p>
            <p className="text-xs text-white/60">
              Type above to search thousands of movies and TV shows.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

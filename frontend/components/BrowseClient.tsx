"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MovieCard } from "@/components/MovieCard";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

const SORTS = [
  { value: "popularity.desc", label: "Most popular" },
  { value: "vote_average.desc", label: "Top rated" },
  { value: "release_date.desc", label: "Newest" },
  { value: "title.asc", label: "A–Z" },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ar", label: "Arabic" },
  { code: "tr", label: "Turkish" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "sv", label: "Swedish" },
  { code: "da", label: "Danish" },
  { code: "no", label: "Norwegian" },
  { code: "fi", label: "Finnish" },
  { code: "th", label: "Thai" },
  { code: "vi", label: "Vietnamese" },
  { code: "id", label: "Indonesian" },
  { code: "el", label: "Greek" },
  { code: "he", label: "Hebrew" },
  { code: "cs", label: "Czech" },
  { code: "hu", label: "Hungarian" },
  { code: "ro", label: "Romanian" },
  { code: "bn", label: "Bengali" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "ms", label: "Malay" },
];

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "IN", label: "India" },
  { code: "CA", label: "Canada" },
  { code: "FR", label: "France" },
  { code: "DE", label: "Germany" },
  { code: "IT", label: "Italy" },
  { code: "ES", label: "Spain" },
  { code: "JP", label: "Japan" },
  { code: "KR", label: "South Korea" },
  { code: "CN", label: "China" },
  { code: "MX", label: "Mexico" },
  { code: "BR", label: "Brazil" },
  { code: "AR", label: "Argentina" },
  { code: "AU", label: "Australia" },
  { code: "NZ", label: "New Zealand" },
  { code: "NL", label: "Netherlands" },
  { code: "BE", label: "Belgium" },
  { code: "SE", label: "Sweden" },
  { code: "NO", label: "Norway" },
  { code: "DK", label: "Denmark" },
  { code: "FI", label: "Finland" },
  { code: "PL", label: "Poland" },
  { code: "CZ", label: "Czech Republic" },
  { code: "RU", label: "Russia" },
  { code: "TR", label: "Turkey" },
  { code: "GR", label: "Greece" },
  { code: "PT", label: "Portugal" },
  { code: "CH", label: "Switzerland" },
  { code: "AT", label: "Austria" },
  { code: "IE", label: "Ireland" },
  { code: "NG", label: "Nigeria" },
  { code: "ZA", label: "South Africa" },
  { code: "EG", label: "Egypt" },
  { code: "IL", label: "Israel" },
  { code: "TH", label: "Thailand" },
  { code: "VN", label: "Vietnam" },
  { code: "ID", label: "Indonesia" },
  { code: "PH", label: "Philippines" },
  { code: "MY", label: "Malaysia" },
  { code: "PK", label: "Pakistan" },
  { code: "BD", label: "Bangladesh" },
];

export interface BrowseParams {
  media_type: string;
  genre: string;
  year: string;
  min_rating: string;
  sort_by: string;
  kind: string;
  language: string;
  country: string;
}

type Filters = BrowseParams;

const DEFAULT_FILTERS: Filters = {
  media_type: "movie",
  genre: "",
  year: "",
  min_rating: "",
  sort_by: "popularity.desc",
  kind: "",
  language: "",
  country: "",
};

function cleanParams(initial: Partial<BrowseParams>): Filters {
  const out: Filters = { ...DEFAULT_FILTERS };
  for (const [k, v] of Object.entries(initial)) {
    if (v !== undefined && v !== null && v !== "") out[k as keyof Filters] = String(v);
  }
  return out;
}

function mediaParam(v: string): string {
  return v === "tv" ? "tv" : "movie";
}

function buildQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.kind === "trending") {
    p.set("time_window", "week");
    return p.toString();
  }
  p.set("media_type", mediaParam(f.media_type));
  p.set("sort_by", f.sort_by || "popularity.desc");
  if (f.genre) p.set("genre", f.genre);
  if (f.year) p.set("year", f.year);
  if (f.min_rating) p.set("min_rating", f.min_rating);
  if (f.language) p.set("language", f.language);
  if (f.country) p.set("origin_country", f.country);
  return p.toString();
}

function urlFor(f: Filters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/browse?${s}` : "/browse";
}

export function BrowseClient({
  initial,
  genres,
}: {
  initial: Partial<BrowseParams>;
  genres: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [f, setF] = useState<Filters>(cleanParams(initial));
  const [items, setItems] = useState<Title[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);
  const busyRef = useRef(false);
  const pageRef = useRef(1);
  const firstRender = useRef(true);

  const isTrending = f.kind === "trending";
  const activeMedia = mediaParam(f.media_type);
  const base = isTrending ? "/api/v1/content/trending" : "/api/v1/content/discover";

  const loadPage = useCallback(
    async (filters: Filters, pageNo: number, append: boolean) => {
      const seq = ++seqRef.current;
      setLoading(true);
      try {
        const data = await get<ContentListResponse>(`${base}?${buildQuery(filters)}&page=${pageNo}`);
        if (seq !== seqRef.current) return;
        const results = (data.results || []).map((t) => ({
          ...t,
          media_type: isTrending ? t.media_type || "movie" : activeMedia,
        }));
        setTotalPages(Math.max(data.total_pages || 1, pageNo));
        setTotalResults(data.total_results || 0);
        setItems((prev) => (append ? [...prev, ...results] : results));
        setError(null);
      } catch {
        if (seq === seqRef.current) setError("Could not load titles. Try again in a moment.");
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [base, isTrending, activeMedia]
  );

  // Reload whenever filters change (also covers nav links & back/forward via router.replace).
  useEffect(() => {
    seqRef.current++;
    setLoading(true);
    setItems([]);
    setPage(1);
    pageRef.current = 1;
    void loadPage(f, 1, false);
  }, [f, loadPage]);

  // Keep state in sync when URL searchParams change via navbar navigation
  const initialKey = JSON.stringify(initial);
  useEffect(() => {
    setF(cleanParams(initial));
  }, [initialKey]);

  // Keep the URL in sync AFTER the commit — navigating inside `update` (during a
  // state-update batch) triggers "Cannot update a component (Router) while
  // rendering a different component". Pushing via an effect runs on a clean render.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    router.replace(urlFor(f), { scroll: false });
  }, [f, router]);

  const update = useCallback((patch: Partial<Filters>) => {
    setF((prev) => ({ ...prev, ...patch }));
  }, []);

  const loadMore = useCallback(() => {
    if (busyRef.current) return;
    const nextPage = pageRef.current + 1;
    busyRef.current = true;
    setPage(nextPage);
    void loadPage(f, nextPage, true).finally(() => {
      busyRef.current = false;
    });
  }, [f, loadPage]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || page >= totalPages) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "600px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [page, totalPages, loadMore]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-wide text-brand-soft">
          {isTrending ? "Trending · updated weekly" : "Browse the catalog"}
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tightest text-text-vivid">
          {isTrending ? "Trending now" : activeMedia === "tv" ? "TV Series" : "Movies"}
        </h1>
        {!loading && totalResults > 0 && (
          <p className="mt-1 text-sm text-text-muted">
            Showing {items.length.toLocaleString()} of {totalResults.toLocaleString()} titles
          </p>
        )}
      </div>

      {!isTrending && (
        <div className="mb-6 flex items-center gap-4 border-b border-white/10">
          {(
            [
              { label: "Movies", media: "movie" },
              { label: "TV Series", media: "tv" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.media}
              onClick={() => update({ media_type: tab.media })}
              className={`relative pb-3 text-sm transition ${
                activeMedia === tab.media ? "font-bold text-text-vivid" : "text-text-muted hover:text-text-vivid"
              }`}
            >
              {tab.label}
              <span
                aria-hidden="true"
                className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand transition-opacity ${
                  activeMedia === tab.media ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {!isTrending && (
        <div className="glass mb-8 flex flex-wrap items-end gap-3 rounded-2xl p-3 text-sm">
          <label className="text-xs uppercase tracking-wide text-text-muted">
            Genre
            <select
              value={f.genre}
              onChange={(e) => update({ genre: e.target.value })}
              className="mt-1 block rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm text-text-vivid focus:border-brand/50"
            >
              <option value="">All genres</option>
              {genres.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-wide text-text-muted">
            Year
            <input
              type="number"
              min={1900}
              max={2100}
              value={f.year}
              onChange={(e) => update({ year: e.target.value })}
              placeholder="Any"
              className="mt-1 block w-24 rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm text-text-vivid focus:border-brand/50"
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-text-muted">
            Min rating
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={f.min_rating}
              onChange={(e) => update({ min_rating: e.target.value })}
              placeholder="Any"
              className="mt-1 block w-24 rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm text-text-vivid focus:border-brand/50"
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-text-muted">
            Language
            <select
              value={f.language}
              onChange={(e) => update({ language: e.target.value })}
              className="mt-1 block rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm text-text-vivid focus:border-brand/50"
            >
              <option value="">All languages</option>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-wide text-text-muted">
            Country
            <select
              value={f.country}
              onChange={(e) => update({ country: e.target.value })}
              className="mt-1 block rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm text-text-vivid focus:border-brand/50"
            >
              <option value="">All countries</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-wide text-text-muted">
            Sort
            <select
              value={f.sort_by}
              onChange={(e) => update({ sort_by: e.target.value })}
              className="mt-1 block rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm text-text-vivid focus:border-brand/50"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() =>
              update({ genre: "", year: "", min_rating: "", sort_by: "popularity.desc", language: "", country: "" })
            }
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-text-muted transition hover:border-brand/50 hover:text-text-vivid"
          >
            Reset
          </button>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[2/3] rounded-2xl" />
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <p className="text-text-muted">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((item, i) => (
              <MovieCard key={`${item.media_type || "movie"}-${item.id}-${i}`} item={item} />
            ))}
          </div>

          {page < totalPages && (
            <div ref={sentinelRef} className="mt-8 flex justify-center">
              {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton aspect-[2/3] rounded-2xl" />
                  ))}
                </div>
              ) : (
                <button
                  onClick={loadMore}
                  className="rounded-full bg-brand px-8 py-2.5 text-sm font-bold text-white shadow-brand-glow transition hover:bg-brand-soft"
                >
                  Load more
                </button>
              )}
            </div>
          )}

          {!loading && page >= totalPages && items.length > 0 && (
            <p className="mt-8 text-center text-sm text-text-muted">
              You&apos;ve reached the end — {items.length.toLocaleString()} titles loaded.
            </p>
          )}

          {error && items.length > 0 && (
            <p className="mt-4 text-center text-sm text-brand-soft">{error}</p>
          )}
        </>
      )}
    </div>
  );
}

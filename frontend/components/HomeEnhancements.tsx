"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MovieCard } from "@/components/MovieCard";
import { EDITORIAL_ARTICLES } from "@/lib/editorial-data";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

const MARQUEE = ["NETFLIX", "Disney+", "prime video", "HBO", "Apple TV+", "hulu", "Paramount+", "YouTube", "tubi", "NBC"];
const PROVIDERS = [
  { name: "Netflix", id: 8 },
  { name: "Apple TV+", id: 350 },
  { name: "Prime Video", id: 9 },
  { name: "Hulu", id: 15 },
  { name: "Max", id: 1899 },
  { name: "Paramount+", id: 531 },
  { name: "Disney+", id: 337 },
];

const GENRES = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "History" },
  { id: 27, name: "Horror" },
  { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Sci-Fi" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37, name: "Western" },
];

export function Top10Carousel({
  title = "TOP 10 Movies",
  items,
  seeAllHref = "/browse?kind=trending",
}: {
  title?: string;
  items: Title[];
  seeAllHref?: string;
}) {
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="h-4 w-1 rounded-full bg-white/40" aria-hidden="true" />
          <h2 className="text-xs font-black uppercase tracking-wider text-white sm:text-sm">{title}</h2>
        </div>
        <Link
          href={seeAllHref}
          className="group inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs font-semibold text-white/90 backdrop-blur-md transition hover:bg-white/10 hover:border-white/20"
        >
          Browse all
          <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
            ›
          </span>
        </Link>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-4">
        {items.slice(0, 10).map((item, i) => (
          <div key={item.id} className="flex shrink-0 items-end">
            <span
              aria-hidden="true"
              className="-mr-4 mb-[-4px] select-none text-[110px] font-black leading-none text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.25)] sm:text-[135px]"
            >
              {i + 1}
            </span>
            <MovieCard item={item} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function DiscoveryHub() {
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [cat, setCat] = useState<"movie" | "tv">("movie");
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    get<ContentListResponse>(
      `/api/v1/content/discover?media_type=${cat}&provider=${provider.id}&watch_region=US&monetization_types=flatrate&sort_by=popularity.desc`
    )
      .then((data) => {
        if (!cancelled) setTitles(data.results.map((item) => ({ ...item, media_type: cat })));
      })
      .catch(() => {
        if (!cancelled) setTitles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provider, cat]);

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="h-4 w-1 rounded-full bg-white/40" aria-hidden="true" />
            <h2 className="text-xs font-black uppercase tracking-wider text-white sm:text-sm">Streaming Providers</h2>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md">
            <button
              onClick={() => setCat("movie")}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                cat === "movie" ? "bg-white text-black shadow-md" : "text-white/70 hover:text-white"
              }`}
            >
              Movies
            </button>
            <button
              onClick={() => setCat("tv")}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                cat === "tv" ? "bg-white text-black shadow-md" : "text-white/70 hover:text-white"
              }`}
            >
              TV Shows
            </button>
          </div>
        </div>
        <Link
          href={`/browse?media_type=${cat}`}
          className="group inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs font-semibold text-white/90 backdrop-blur-md transition hover:bg-white/10 hover:border-white/20"
        >
          All providers
          <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
            ›
          </span>
        </Link>
      </div>

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        {PROVIDERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setProvider(item)}
            aria-pressed={provider.id === item.id}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              provider.id === item.id
                ? "border-white bg-white text-black shadow-md"
                : "border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:text-white"
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-3 min-h-[220px]">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-[220px] w-36 shrink-0 rounded-2xl sm:w-44" />)
        ) : titles.length ? (
          titles.slice(0, 12).map((item) => <MovieCard key={`${provider.id}-${item.id}`} item={item} />)
        ) : (
          <p className="py-12 text-sm text-text-muted">No titles are currently listed for this provider.</p>
        )}
      </div>
    </section>
  );
}

export function TopRatedHub() {
  const [cat, setCat] = useState<"movie" | "tv">("movie");
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    get<ContentListResponse>(`/api/v1/content/top-rated?media_type=${cat}`, 1800)
      .then((data) => {
        if (!cancelled) setTitles(data.results.map((item) => ({ ...item, media_type: cat })));
      })
      .catch(() => {
        if (!cancelled) setTitles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cat]);

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="h-4 w-1 rounded-full bg-white/40" aria-hidden="true" />
            <h2 className="text-xs font-black uppercase tracking-wider text-white sm:text-sm">Top Rated</h2>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md">
            <button
              onClick={() => setCat("movie")}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                cat === "movie" ? "bg-white text-black shadow-md" : "text-white/70 hover:text-white"
              }`}
            >
              Movies
            </button>
            <button
              onClick={() => setCat("tv")}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                cat === "tv" ? "bg-white text-black shadow-md" : "text-white/70 hover:text-white"
              }`}
            >
              TV Shows
            </button>
          </div>
        </div>
        <Link
          href={`/browse?media_type=${cat}&sort_by=vote_average.desc`}
          className="group inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs font-semibold text-white/90 backdrop-blur-md transition hover:bg-white/10 hover:border-white/20"
        >
          Browse all
          <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
            ›
          </span>
        </Link>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-3 min-h-[220px]">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-[220px] w-36 shrink-0 rounded-2xl sm:w-44" />
          ))
        ) : titles.length ? (
          titles.slice(0, 12).map((item) => <MovieCard key={`${cat}-${item.id}`} item={item} />)
        ) : (
          <p className="py-12 text-sm text-text-muted">Loading top rated titles…</p>
        )}
      </div>
    </section>
  );
}

export function GenreBrowseHub() {
  const [cat, setCat] = useState<"movie" | "tv">("movie");
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    get<ContentListResponse>(
      `/api/v1/content/discover?media_type=${cat}&genre=${selectedGenre.id}&sort_by=popularity.desc`
    )
      .then((data) => {
        if (!cancelled) setTitles(data.results.map((item) => ({ ...item, media_type: cat })));
      })
      .catch(() => {
        if (!cancelled) setTitles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cat, selectedGenre]);

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="h-4 w-1 rounded-full bg-white/40" aria-hidden="true" />
            <h2 className="text-xs font-black uppercase tracking-wider text-white sm:text-sm">Browse by Genre</h2>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md">
            <button
              onClick={() => setCat("movie")}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                cat === "movie" ? "bg-white text-black shadow-md" : "text-white/70 hover:text-white"
              }`}
            >
              Movies
            </button>
            <button
              onClick={() => setCat("tv")}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                cat === "tv" ? "bg-white text-black shadow-md" : "text-white/70 hover:text-white"
              }`}
            >
              TV Shows
            </button>
          </div>
        </div>
        <Link
          href={`/browse?media_type=${cat}&genre=${selectedGenre.id}`}
          className="group inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs font-semibold text-white/90 backdrop-blur-md transition hover:bg-white/10 hover:border-white/20"
        >
          Browse all
          <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
            ›
          </span>
        </Link>
      </div>

      {/* Genre Pills */}
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        {GENRES.map((g) => (
          <button
            key={g.id}
            onClick={() => setSelectedGenre(g)}
            aria-pressed={selectedGenre.id === g.id}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              selectedGenre.id === g.id
                ? "border-white bg-white text-black shadow-md"
                : "border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:text-white"
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-3 min-h-[220px]">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-[220px] w-36 shrink-0 rounded-2xl sm:w-44" />
          ))
        ) : titles.length ? (
          titles.slice(0, 12).map((item) => <MovieCard key={`${cat}-${selectedGenre.id}-${item.id}`} item={item} />)
        ) : (
          <p className="py-12 text-sm text-text-muted">Loading {selectedGenre.name} titles…</p>
        )}
      </div>
    </section>
  );
}

export function ProviderMarquee() {
  return (
    <section aria-label="Supported streaming platforms" className="mx-auto max-w-7xl overflow-hidden px-4 sm:px-6">
      <div className="provider-marquee relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] py-4">
        <div className="provider-track flex w-max items-center gap-12 px-8 text-base font-bold tracking-tight text-white/30 sm:gap-16 sm:text-lg">
          {[...MARQUEE, ...MARQUEE].map((provider, i) => (
            <span key={`${provider}-${i}`} className="whitespace-nowrap">
              {provider}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EditorsPickSpotlight() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#09090B]/70 p-6 sm:p-8 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div>
            <span className="cinema-label text-[10px]">
              Curator&apos;s Highlight
            </span>
            <h2 className="mt-2 text-2xl font-bold text-[#FAFAFA]">Editor&apos;s Pick of the Week</h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs font-semibold text-text-muted">
            Updated Weekly
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 items-center">
          <div className="relative aspect-[2/3] w-48 shrink-0 overflow-hidden rounded-2xl border border-white/15 mx-auto md:col-span-3">
            <Image
              src="https://image.tmdb.org/t/p/w500/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg"
              alt="Dune: Part Two"
              fill
              className="object-cover"
            />
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2.5 py-0.5 font-mono text-xs font-bold text-[var(--brand-accent)] backdrop-blur-md">
              <svg className="h-3.5 w-3.5 fill-[var(--brand-accent)] text-[var(--brand-accent)]" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> 8.6
            </span>
          </div>

          <div className="space-y-4 md:col-span-9">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-0.5 text-xs font-bold text-white uppercase">
                Sci-Fi Masterpiece
              </span>
              <span className="font-mono text-xs text-text-muted">2024 • 166 min</span>
            </div>
            <h3 className="text-3xl font-bold text-[#FAFAFA]">Dune: Part Two</h3>
            <p className="text-sm leading-relaxed text-[#A1A1AA]">
              Denis Villeneuve&apos;s sci-fi masterpiece reaches its breathtaking climax. Balancing massive desert spectacle with intimate character dynamics between Paul Atreides and Chani, the film delivers unmissable audio-visual scale. Hans Zimmer&apos;s thunderous score and Greig Fraser&apos;s crisp IMAX lens make this the definitive cinematic experience of the year.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/movie/693134"
                className="cinema-btn-accent font-bold shadow-xl"
              >
                Read Editorial Analysis &rarr;
              </Link>
              <Link
                href="/watch/movie/693134"
                className="cinema-btn-pill font-semibold"
              >
                Play Now
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FeaturedEditorialSection() {
  const articles = EDITORIAL_ARTICLES.slice(0, 3);
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="mb-6 flex items-end justify-between border-b border-white/10 pb-4">
        <div>
          <span className="cinema-label text-[10px]">
            Original Film Criticism
          </span>
          <h2 className="mt-2 text-2xl font-bold text-[#FAFAFA]">From the Editorial Hub</h2>
        </div>
        <Link href="/editorial" className="text-xs font-semibold text-white/90 hover:underline transition">
          View All Stories &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={`/editorial/${article.slug}`}
            className="card-lift group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#09090B]/60 hover:border-white/30"
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden">
              <Image
                src={article.coverImage}
                alt={article.title}
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/70 px-3 py-1 font-mono text-[11px] font-bold text-[#FAFAFA] backdrop-blur-md">
                {article.category}
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-between p-5">
              <div>
                <span className="font-mono text-[11px] text-text-muted">{article.readTime}</span>
                <h3 className="mt-1.5 text-lg font-bold text-[#FAFAFA] leading-snug group-hover:text-white transition">
                  {article.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#A1A1AA]">
                  {article.excerpt}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2.5 border-t border-white/10 pt-3">
                <div className="relative h-6 w-6 overflow-hidden rounded-full ring-1 ring-white/10">
                  <Image src={article.author.avatar} alt={article.author.name} fill className="object-cover" />
                </div>
                <span className="text-xs font-semibold text-text-vivid">{article.author.name}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto max-w-7xl px-4 sm:px-6 pb-12 pt-12 text-[#A1A1AA]">
      <div className="border-t border-white/10 pt-10">
        {/* CinemaOS Tagline Header Band */}
        <div className="mb-8 text-center sm:text-left">
          <h2 className="text-xl font-black text-white sm:text-2xl tracking-tight">
            All Your Favorite Platforms In One Place
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-white/70">
            <Link href="/" className="hover:text-white transition">Home</Link> ·
            <Link href="/movies" className="hover:text-white transition">Movies</Link> ·
            <Link href="/tv" className="hover:text-white transition">TV Shows</Link> ·
            <Link href="/anime" className="hover:text-white transition">Anime Hub</Link> ·
            <Link href="/sports" className="hover:text-white transition">Live Sports</Link> ·
            <Link href="/search" className="hover:text-white transition">Search</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-5 mb-10">
          <div className="md:col-span-2 space-y-3">
            <p className="text-2xl font-black tracking-tight text-[#FAFAFA]">
              CinemaOS <span className="text-xs font-normal text-white/50">(Apollo Hub)</span>
            </p>
            <p className="max-w-sm text-xs sm:text-sm leading-relaxed text-[#A1A1AA]">
              Your ultimate entertainment hub. Powered by Consumet & TMDB API for seamless catalog discovery, live match schedules, and synchronized watch rooms.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-vivid mb-3">Discovery</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li><Link href="/browse?kind=trending" className="hover:text-white transition">Trending Titles</Link></li>
              <li><Link href="/movies" className="hover:text-white transition">Movies</Link></li>
              <li><Link href="/tv" className="hover:text-white transition">TV Series</Link></li>
              <li><Link href="/anime" className="hover:text-white transition">Anime Hub</Link></li>
              <li><Link href="/movie-night" className="hover:text-white transition">Movie Night Room</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-vivid mb-3">Editorial</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li><Link href="/editorial" className="font-semibold text-white hover:underline transition">Editorial Hub</Link></li>
              <li><Link href="/editorial/top-sci-fi-masterpieces-2020s" className="hover:text-white transition">Sci-Fi Guides</Link></li>
              <li><Link href="/editorial/ultimate-anime-canon-filler-guide" className="hover:text-white transition">Anime Filler Guides</Link></li>
              <li><Link href="/editorial/cinema-os-ai-movie-night" className="hover:text-white transition">AI Insights</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-vivid mb-3">Legal</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li><Link href="/about" className="hover:text-white transition">About Us</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></li>
              <li><Link href="/faq" className="hover:text-white transition">FAQ & Help</Link></li>
              <li><Link href="/contact" className="hover:text-white transition">DMCA Notice</Link></li>
            </ul>
          </div>
        </div>

        {/* CinemaOS Legal Disclaimer Card */}
        <div className="rounded-3xl border border-white/10 bg-[#09090B]/60 p-6 backdrop-blur-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🍿</span>
              <p className="text-xs font-bold uppercase tracking-wider text-white">Important Disclaimer</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-white/80">
                Third-party Content
              </span>
              <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-white/80">
                No File Hosting
              </span>
            </div>
          </div>
          <p className="max-w-4xl text-xs sm:text-sm leading-relaxed text-[#A1A1AA]">
            Apollo (CinemaOS) operates strictly as an index and media information aggregator. We do not host, store, or upload media files to our servers. Metadata, artwork, and third-party links are indexed from public APIs in accordance with fair use standards. For copyright inquiries, please submit notices to our <Link href="/contact" className="text-white hover:underline font-semibold">DMCA Contact Portal</Link>.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-6 text-xs text-white/60">
          <p>© {new Date().getFullYear()} Apollo CinemaOS. All rights reserved.</p>
          <p className="font-medium text-white/80">Built with ❤️ for entertainment enthusiasts worldwide</p>
        </div>
      </div>
    </footer>
  );
}
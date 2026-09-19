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

export function Top10Carousel({ items }: { items: Title[] }) {
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">Ranked today</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-text-vivid sm:text-3xl">Top 10 in Apollo</h2>
        </div>
        <Link href="/browse?kind=trending" className="text-xs font-semibold text-brand-soft hover:text-brand transition">
          Browse all →
        </Link>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-4">
        {items.slice(0, 10).map((item, i) => (
          <div key={item.id} className="flex shrink-0 items-end">
            <span
              aria-hidden="true"
              className="-mr-4 mb-[-4px] select-none text-[110px] font-extrabold leading-none text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.22)] sm:text-[135px]"
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
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    get<ContentListResponse>(
      `/api/v1/content/discover?media_type=movie&provider=${provider.id}&watch_region=US&monetization_types=flatrate&sort_by=popularity.desc`
    )
      .then((data) => {
        if (!cancelled) setTitles(data.results.map((item) => ({ ...item, media_type: "movie" })));
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
  }, [provider]);

  return (
    <section className="mx-auto max-w-7xl px-4">
      <div className="rounded-3xl border border-white/[0.08] bg-[#1B1E27]/60 p-6 sm:p-8 backdrop-blur-xl">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">Curated streaming</p>
        <h2 className="mb-5 mt-1 text-2xl font-extrabold text-text-vivid sm:text-3xl">Explore by platform</h2>
        <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
          {PROVIDERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setProvider(item)}
              aria-pressed={provider.id === item.id}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${
                provider.id === item.id
                  ? "border-brand/50 bg-brand/15 text-white"
                  : "border-white/10 bg-white/[0.03] text-text-muted hover:border-white/20 hover:text-white"
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>
        <p className="mb-4 text-xs font-mono text-text-muted">
          Popular titles on <span className="font-semibold text-text-vivid">{provider.name}</span>
        </p>
        <div className="no-scrollbar flex min-h-[216px] gap-3.5 overflow-x-auto pb-2">
          {loading ? (
            Array.from({ length: 7 }).map((_, i) => <div key={i} className="skeleton h-[216px] w-36 shrink-0 rounded-2xl sm:w-44" />)
          ) : titles.length ? (
            titles.slice(0, 10).map((item) => <MovieCard key={`${provider.id}-${item.id}`} item={item} />)
          ) : (
            <p className="py-16 text-sm text-text-muted">No titles are currently listed for this provider.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function ProviderMarquee() {
  return (
    <section aria-label="Supported streaming platforms" className="mx-auto max-w-7xl overflow-hidden px-4">
      <div className="provider-marquee relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.015] py-4">
        <div className="provider-track flex w-max items-center gap-12 px-8 text-base font-extrabold tracking-tight text-white/30 sm:gap-16 sm:text-lg">
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

export function HomeIntroBanner() {
  return (
    <section className="mx-auto max-w-7xl px-4">
      <div className="rounded-3xl border border-white/[0.08] bg-[#1B1E27]/60 p-6 sm:p-8 backdrop-blur-xl">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
          Welcome to Apollo
        </span>
        <h2 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
          Cinematic Discovery & Curation
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-muted sm:text-base">
          Apollo simplifies your streaming choices by consolidating legal options across Netflix, Prime Video, Apple TV+, and Disney+. Powered by contextual recommendation algorithms, original film criticism, and synchronized watch rooms for group viewing.
        </p>
      </div>
    </section>
  );
}

export function EditorsPickSpotlight() {
  return (
    <section className="mx-auto max-w-7xl px-4">
      <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#1B1E27]/70 p-6 sm:p-8 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-6">
          <div>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
              Curator&apos;s Highlight
            </span>
            <h2 className="text-2xl font-extrabold text-white">Editor&apos;s Pick of the Week</h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-xs font-semibold text-text-muted">
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
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 font-mono text-xs font-bold text-[#FFD166] backdrop-blur-md">
              <svg className="h-3.5 w-3.5 fill-[#FFD166] text-[#FFD166]" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> 8.6
            </span>
          </div>

          <div className="space-y-4 md:col-span-9">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-0.5 text-xs font-bold text-text-vivid uppercase">
                Sci-Fi Masterpiece
              </span>
              <span className="font-mono text-xs text-text-muted">2024 • 166 min</span>
            </div>
            <h3 className="text-3xl font-extrabold text-white">Dune: Part Two</h3>
            <p className="text-sm leading-relaxed text-text-muted">
              Denis Villeneuve&apos;s sci-fi masterpiece reaches its breathtaking climax. Balancing massive desert spectacle with intimate character dynamics between Paul Atreides and Chani, the film delivers unmissable audio-visual scale. Hans Zimmer&apos;s thunderous score and Greig Fraser&apos;s crisp IMAX lens make this the definitive cinematic experience of the year.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/movie/693134"
                className="rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow-brand-glow transition hover:bg-brand-soft"
              >
                Read Editorial Analysis &rarr;
              </Link>
              <Link
                href="/watch/movie/693134"
                className="rounded-full border border-white/15 bg-white/[0.06] px-6 py-2.5 text-sm font-semibold text-text-vivid backdrop-blur-md transition hover:bg-white/15"
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
    <section className="mx-auto max-w-7xl px-4">
      <div className="mb-6 flex items-end justify-between border-b border-white/[0.08] pb-4">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
            Original Film Criticism
          </span>
          <h2 className="text-2xl font-extrabold text-white">From the Editorial Hub</h2>
        </div>
        <Link href="/editorial" className="text-xs font-semibold text-brand-soft hover:text-brand transition">
          View All Stories &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={`/editorial/${article.slug}`}
            className="card-lift group flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#1B1E27]"
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden">
              <Image
                src={article.coverImage}
                alt={article.title}
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 font-mono text-[11px] font-bold text-white backdrop-blur-md">
                {article.category}
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-between p-5">
              <div>
                <span className="font-mono text-[11px] text-text-muted">{article.readTime}</span>
                <h3 className="mt-1.5 text-lg font-bold text-white leading-snug group-hover:text-brand-soft transition">
                  {article.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-muted">
                  {article.excerpt}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2.5 border-t border-white/[0.08] pt-3">
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
    <footer className="mx-auto max-w-7xl px-4 pb-12 pt-12 text-white/75">
      <div className="border-t border-white/10 pt-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-5 mb-10">
          <div className="md:col-span-2">
            <p className="text-2xl font-extrabold tracking-tight text-white">
              Apollo<span className="text-brand">.</span>
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed">
              Legal movie & series discovery platform powered by CinemaOS AI recommendation engine and curated film editorial guides.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-vivid mb-3">Discovery</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/browse?kind=trending" className="hover:text-white transition">Trending Titles</Link></li>
              <li><Link href="/browse?media_type=movie" className="hover:text-white transition">Movies</Link></li>
              <li><Link href="/browse?media_type=tv" className="hover:text-white transition">TV Shows</Link></li>
              <li><Link href="/anime" className="hover:text-white transition">Anime Hub</Link></li>
              <li><Link href="/movie-night" className="hover:text-white transition">Movie Night Room</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-vivid mb-3">Editorial & Content</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/editorial" className="font-semibold text-brand-soft hover:text-white transition">Editorial Hub</Link></li>
              <li><Link href="/editorial/top-sci-fi-masterpieces-2020s" className="hover:text-white transition">Sci-Fi Guides</Link></li>
              <li><Link href="/editorial/ultimate-anime-canon-filler-guide" className="hover:text-white transition">Anime Filler Guides</Link></li>
              <li><Link href="/editorial/cinema-os-ai-movie-night" className="hover:text-white transition">AI Insights</Link></li>
              <li><Link href="/editorial/underrated-gem-thrillers" className="hover:text-white transition">Hidden Gem Thrillers</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-vivid mb-3">Legal & Company</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/about" className="hover:text-white transition">About Us</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></li>
              <li><Link href="/faq" className="hover:text-white transition">FAQ & Help</Link></li>
              <li><Link href="/contact" className="hover:text-white transition">Contact & DMCA</Link></li>
            </ul>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[rgba(17,19,26,0.6)] p-6">
          <p className="mb-2 text-sm font-bold text-white">Legal Aggregation & Copyright Disclaimer</p>
          <p className="max-w-4xl text-xs sm:text-sm leading-6">
            Apollo operates strictly as an informational index and content aggregator. We do not host, store, or upload media files on our infrastructure. All metadata, artwork, and streaming availability are indexed from public APIs in accordance with fair use and API terms. For copyright concerns or DMCA notices, please submit inquiries via our <Link href="/contact" className="text-brand-soft hover:underline">Contact & DMCA Portal</Link>.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-6 text-xs">
          <p>© {new Date().getFullYear()} Apollo. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/contact" className="hover:text-white">DMCA</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
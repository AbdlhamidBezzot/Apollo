"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MovieCard } from "@/components/MovieCard";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";
const MARQUEE = ["NETFLIX", "Disney+", "prime video", "HBO", "Apple TV+", "hulu", "Paramount+", "YouTube", "tubi", "NBC"];
const PROVIDERS = [{ name: "Netflix", id: 8 }, { name: "Apple TV+", id: 350 }, { name: "Prime Video", id: 9 }, { name: "Hulu", id: 15 }, { name: "Max", id: 1899 }, { name: "Paramount+", id: 531 }, { name: "Disney+", id: 337 }];
export function Top10Carousel({ items }: { items: Title[] }) { if (!items.length) return null; return <section className="mx-auto max-w-7xl px-4"><div className="mb-4 flex items-end justify-between"><div><p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-brand-soft">Ranked now</p><h2 className="mt-1 text-2xl font-extrabold tracking-tightest text-text-vivid">Top 10 in Apollo today</h2></div><Link href="/browse?kind=trending" className="text-sm font-semibold text-brand-soft hover:text-brand">Browse all</Link></div><div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 pb-4">{items.slice(0, 10).map((item, i) => <div key={item.id} className="flex shrink-0 items-end"><span aria-hidden="true" className="-mr-4 mb-[-5px] select-none text-[112px] font-extrabold leading-none text-transparent [-webkit-text-stroke:2px_rgba(255,255,255,0.34)] sm:text-[142px]">{i + 1}</span><MovieCard item={item} /></div>)}</div></section>; }
export function DiscoveryHub() { const [provider, setProvider] = useState(PROVIDERS[0]); const [titles, setTitles] = useState<Title[]>([]); const [loading, setLoading] = useState(true); useEffect(() => { let cancelled = false; setLoading(true); get<ContentListResponse>(`/api/v1/content/discover?media_type=movie&provider=${provider.id}&watch_region=US&monetization_types=flatrate&sort_by=popularity.desc`).then((data) => { if (!cancelled) setTitles(data.results.map((item) => ({ ...item, media_type: "movie" }))); }).catch(() => { if (!cancelled) setTitles([]); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [provider]); return <section className="mx-auto max-w-7xl px-4"><div className="glass rounded-3xl p-5"><p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-brand-soft">Made for your evening</p><h2 className="mb-4 mt-1 text-2xl font-extrabold tracking-tightest text-text-vivid">Explore every platform</h2><div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-2">{PROVIDERS.map((item) => <button key={item.id} type="button" onClick={() => setProvider(item)} aria-pressed={provider.id === item.id} className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-bold transition ${provider.id === item.id ? "border-brand bg-brand/15 text-white shadow-brand-glow" : "border-white/10 text-text-muted hover:border-white/30 hover:text-text-vivid"}`}>{item.name}</button>)}</div><p className="mb-3 text-xs text-text-muted">Streaming on <span className="font-semibold text-text-vivid">{provider.name}</span> in the United States</p><div className="no-scrollbar flex min-h-[216px] gap-3 overflow-x-auto pb-2">{loading ? Array.from({ length: 7 }).map((_, i) => <div key={i} className="skeleton h-[216px] w-36 shrink-0 rounded-2xl sm:w-44" />) : titles.length ? titles.slice(0, 10).map((item) => <MovieCard key={`${provider.id}-${item.id}`} item={item} />) : <p className="py-16 text-sm text-text-muted">No titles are currently listed for this provider and region.</p>}</div></div></section>; }
export function ProviderMarquee() { return <section aria-label="Supported streaming platforms" className="mx-auto max-w-7xl overflow-hidden px-4"><div className="provider-marquee relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] py-5"><div className="provider-track flex w-max items-center gap-12 px-8 text-lg font-extrabold tracking-tight text-white/35 sm:gap-16 sm:text-xl">{[...MARQUEE, ...MARQUEE].map((provider, i) => <span key={`${provider}-${i}`} className="whitespace-nowrap">{provider}</span>)}</div></div></section>; }
export function Footer() {
  return (
    <footer className="mx-auto max-w-7xl px-4 pb-12 pt-16 text-text-muted">
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
            <ul className="space-y-2 text-sm">
              <li><Link href="/browse?kind=trending" className="hover:text-white transition">Trending Titles</Link></li>
              <li><Link href="/browse?media_type=movie" className="hover:text-white transition">Movies</Link></li>
              <li><Link href="/browse?media_type=tv" className="hover:text-white transition">TV Shows</Link></li>
              <li><Link href="/anime" className="hover:text-white transition">Anime Hub</Link></li>
              <li><Link href="/movie-night" className="hover:text-white transition">Movie Night Room</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-vivid mb-3">Editorial & Content</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/editorial" className="font-semibold text-brand-soft hover:text-white transition">Editorial Hub</Link></li>
              <li><Link href="/editorial/top-sci-fi-masterpieces-2020s" className="hover:text-white transition">Sci-Fi Guides</Link></li>
              <li><Link href="/editorial/ultimate-anime-canon-filler-guide" className="hover:text-white transition">Anime Filler Guides</Link></li>
              <li><Link href="/editorial/cinema-os-ai-movie-night" className="hover:text-white transition">AI Insights</Link></li>
              <li><Link href="/editorial/underrated-gem-thrillers" className="hover:text-white transition">Hidden Gem Thrillers</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-vivid mb-3">Legal & Company</h3>
            <ul className="space-y-2 text-sm">
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
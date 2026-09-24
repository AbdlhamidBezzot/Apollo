"use client";

import Link from "next/link";
import { MobileMovieCard } from "./MobileMovieCard";
import type { Title } from "@/lib/types";

export function MobileMovieCarousel({
  title,
  items,
  seeAllHref,
  isTop10 = false,
}: {
  title: string;
  items: Title[];
  seeAllHref?: string;
  isTop10?: boolean;
}) {
  if (!items || items.length === 0) return null;
  const displayItems = isTop10 ? items.slice(0, 10) : items.slice(0, 15);

  return (
    <section className="space-y-2 py-2">
      {/* Header */}
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-1 rounded-full bg-[var(--brand-accent)]" />
          <h2 className="text-sm font-black uppercase tracking-wider text-white">{title}</h2>
        </div>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="flex items-center gap-0.5 text-xs font-semibold text-[var(--brand-accent)] transition active:opacity-70"
          >
            See all
            <span>→</span>
          </Link>
        )}
      </div>

      {/* Horizontal Carousel */}
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory">
        {displayItems.map((item, index) => (
          <div key={`${item.media_type || "movie"}-${item.id}`} className="snap-start">
            <MobileMovieCard item={item} rank={isTop10 ? index + 1 : undefined} />
          </div>
        ))}
      </div>
    </section>
  );
}

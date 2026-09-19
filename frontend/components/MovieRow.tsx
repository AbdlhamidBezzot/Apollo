import Link from "next/link";
import { MovieCard } from "@/components/MovieCard";
import type { Title } from "@/lib/types";

export function MovieRow({ title, items, seeAllHref }: { title: string; items: Title[]; seeAllHref?: string }) {
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="h-4 w-1 rounded-full bg-white/40" aria-hidden="true" />
          <h2 className="text-xs font-black uppercase tracking-wider text-white sm:text-sm">{title}</h2>
        </div>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="group inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs font-semibold text-white/90 backdrop-blur-md transition hover:bg-white/10 hover:border-white/20"
          >
            Browse all
            <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
              ›
            </span>
          </Link>
        )}
      </div>
      <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-3">
        {items.map((item) => (
          <MovieCard key={`${item.media_type || "movie"}-${item.id}`} item={item} />
        ))}
      </div>
    </section>
  );
}

import Link from "next/link";
import { MovieCard } from "@/components/MovieCard";
import type { Title } from "@/lib/types";

export function MovieRow({ title, items, seeAllHref }: { title: string; items: Title[]; seeAllHref?: string }) {
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-xl font-extrabold tracking-tight text-text-vivid">{title}</h2>
        <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="group inline-flex items-center gap-1 text-sm font-semibold text-brand-soft transition hover:text-brand"
          >
            See all
            <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
              →
            </span>
          </Link>
        )}
      </div>
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {items.map((item) => (
          <MovieCard key={`${item.media_type || "movie"}-${item.id}`} item={item} />
        ))}
      </div>
    </section>
  );
}

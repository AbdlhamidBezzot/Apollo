import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EDITORIAL_ARTICLES } from "@/lib/editorial-data";

export const metadata: Metadata = {
  title: "Editorial & Film Guides | Apollo Cinema Hub",
  description:
    "Explore original film reviews, in-depth genre guides, anime canon vs filler breakdowns, and AI streaming insights curated by Apollo film critics.",
};

export default function EditorialHubPage() {
  const featured = EDITORIAL_ARTICLES[0];
  const articles = EDITORIAL_ARTICLES.slice(1);

  return (
    <div className="min-h-screen bg-bg-void px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-12">
        {/* Editorial Header */}
        <header className="text-center">
          <span className="inline-block rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-brand-soft">
            Original Cinema Criticism & Guides
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-text-vivid sm:text-5xl lg:text-6xl">
            Apollo Editorial<span className="text-brand">.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-text-muted sm:text-lg">
            Deep-dive film analyses, curated streaming guides, anime arc breakdowns, and perspectives on the future of cinema technology.
          </p>
        </header>

        {/* Featured Article Card */}
        {featured && (
          <section>
            <Link
              href={`/editorial/${featured.slug}`}
              className="card-lift group relative block overflow-hidden rounded-3xl border border-white/10 bg-bg-card shadow-glass"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12">
                <div className="relative aspect-video w-full overflow-hidden lg:col-span-7 lg:aspect-auto">
                  <Image
                    src={featured.coverImage}
                    alt={featured.title}
                    fill
                    priority
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-transparent to-transparent lg:hidden" />
                </div>
                <div className="flex flex-col justify-center p-6 sm:p-10 lg:col-span-5">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-brand/40 bg-brand/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-soft">
                      {featured.category}
                    </span>
                    <span className="font-mono text-xs text-text-muted">{featured.readTime}</span>
                  </div>
                  <h2 className="mt-4 text-2xl font-extrabold text-white transition group-hover:text-brand-soft sm:text-3xl">
                    {featured.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-text-muted line-clamp-3">
                    {featured.subtitle}
                  </p>

                  <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
                    <div className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-white/10">
                      <Image src={featured.author.avatar} alt={featured.author.name} fill className="object-cover" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-vivid">{featured.author.name}</p>
                      <p className="text-[11px] text-text-muted">{featured.publishedAt}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* Articles Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-2xl font-extrabold text-text-vivid">Latest Articles & Reviews</h2>
            <span className="font-mono text-xs text-text-muted">{EDITORIAL_ARTICLES.length} Published Articles</span>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={`/editorial/${article.slug}`}
                className="card-lift group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-bg-card shadow-glass"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden">
                  <Image
                    src={article.coverImage}
                    alt={article.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 400px"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <span className="glass absolute left-3 top-3 rounded-full px-3 py-1 font-mono text-[11px] font-bold text-white">
                    {article.category}
                  </span>
                </div>

                <div className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    <span className="font-mono text-[11px] text-text-muted">{article.readTime}</span>
                    <h3 className="mt-2 text-xl font-bold leading-snug text-white transition group-hover:text-brand-soft">
                      {article.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-text-muted">
                      {article.excerpt}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
                    <div className="relative h-8 w-8 overflow-hidden rounded-full ring-1 ring-white/10">
                      <Image src={article.author.avatar} alt={article.author.name} fill className="object-cover" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-vivid">{article.author.name}</p>
                      <p className="text-[10px] text-text-muted">{article.publishedAt}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

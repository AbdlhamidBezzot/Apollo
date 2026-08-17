import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { EDITORIAL_ARTICLES } from "@/lib/editorial-data";

export async function generateStaticParams() {
  return EDITORIAL_ARTICLES.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = EDITORIAL_ARTICLES.find((a) => a.slug === slug);
  if (!article) return {};

  return {
    title: `${article.title} | Apollo Editorial`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      publishedTime: article.publishedAt,
      authors: [article.author.name],
      images: [{ url: article.coverImage }],
    },
  };
}

export default async function EditorialArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = EDITORIAL_ARTICLES.find((a) => a.slug === slug);

  if (!article) {
    notFound();
  }

  const related = EDITORIAL_ARTICLES.filter((a) => article.relatedSlugs.includes(a.slug));

  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    image: [article.coverImage],
    datePublished: article.publishedAt,
    author: {
      "@type": "Person",
      name: article.author.name,
      jobTitle: article.author.role,
    },
    publisher: {
      "@type": "Organization",
      name: "Apollo",
      url: "https://apollo-stream.com",
    },
  };

  return (
    <div className="min-h-screen bg-bg-void px-4 py-12 sm:px-6 lg:px-8">
      <JsonLd data={jsonLdData} />
      <article className="mx-auto max-w-4xl space-y-10">
        {/* Navigation Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-text-muted">
          <Link href="/editorial" className="hover:text-brand-soft">
            &larr; Back to Editorial Hub
          </Link>
          <span>/</span>
          <span className="text-brand-soft uppercase">{article.category}</span>
        </nav>

        {/* Header */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-brand/40 bg-brand/15 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-brand-soft">
              {article.category}
            </span>
            <span className="font-mono text-xs text-text-muted">{article.readTime}</span>
            <span className="font-mono text-xs text-text-muted">• {article.publishedAt}</span>
          </div>

          <h1 className="text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl leading-tight">
            {article.title}
          </h1>
          <p className="text-lg leading-relaxed text-text-muted">{article.subtitle}</p>

          <div className="flex items-center gap-4 border-y border-white/10 py-4">
            <div className="relative h-12 w-12 overflow-hidden rounded-full ring-2 ring-white/10">
              <Image src={article.author.avatar} alt={article.author.name} fill className="object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-vivid">{article.author.name}</p>
              <p className="text-xs text-text-muted">{article.author.role}</p>
            </div>
          </div>
        </header>

        {/* Cover Image */}
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl border border-white/10 shadow-glass">
          <Image src={article.coverImage} alt={article.title} fill priority className="object-cover" />
        </div>

        {/* Article Body Content */}
        <main className="space-y-8 text-base leading-relaxed text-text-vivid/90">
          {article.content.map((block, idx) => {
            if (block.type === "paragraph") {
              return (
                <p key={idx} className="text-base sm:text-lg leading-relaxed text-text-muted">
                  {block.text}
                </p>
              );
            }
            if (block.type === "heading2") {
              return (
                <h2 key={idx} className="text-2xl font-extrabold text-white pt-4 border-t border-white/10">
                  {block.text}
                </h2>
              );
            }
            if (block.type === "heading3") {
              return (
                <h3 key={idx} className="text-xl font-bold text-text-vivid pt-2">
                  {block.text}
                </h3>
              );
            }
            if (block.type === "callout") {
              return (
                <div key={idx} className="rounded-2xl border border-brand/40 bg-brand/10 p-6 text-sm text-text-vivid">
                  <p className="font-semibold leading-relaxed">{block.text}</p>
                </div>
              );
            }
            if (block.type === "list" && block.items) {
              return (
                <ul key={idx} className="list-disc pl-6 space-y-2 text-text-muted">
                  {block.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              );
            }
            if (block.type === "film-card" && block.film) {
              const { film } = block;
              return (
                <div key={idx} className="glass my-6 overflow-hidden rounded-3xl p-6 shadow-glass">
                  <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="relative h-48 w-32 shrink-0 overflow-hidden rounded-xl border border-white/10">
                      <Image src={film.poster} alt={film.title} fill className="object-cover" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xl font-extrabold text-white">{film.title} <span className="text-sm font-normal text-text-muted">({film.year})</span></h4>
                        <span className="glass flex items-center gap-1 rounded-md px-2.5 py-1 font-mono text-xs font-bold text-yellow-400">
                          <svg className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> {film.rating}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-brand-soft">{film.genre}</p>
                      <p className="text-sm text-text-muted line-clamp-3">{film.overview}</p>
                      <div className="pt-2 flex items-center justify-between">
                        <p className="text-xs font-bold text-text-vivid">Verdict: <span className="text-text-muted font-normal">{film.verdict}</span></p>
                        <Link
                          href={`/${film.mediaType}/${film.tmdbId}`}
                          className="rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-white shadow-brand-glow hover:bg-brand-soft"
                        >
                          View Title &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </main>

        {/* Related Articles Footer */}
        {related.length > 0 && (
          <footer className="border-t border-white/10 pt-10 space-y-6">
            <h3 className="text-2xl font-bold text-white">Related Editorial Stories</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/editorial/${item.slug}`}
                  className="card-lift glass flex flex-col justify-between rounded-2xl p-5 shadow-glass"
                >
                  <div>
                    <span className="font-mono text-[10px] uppercase text-brand-soft font-bold">{item.category}</span>
                    <h4 className="mt-1 text-lg font-bold text-white leading-snug">{item.title}</h4>
                    <p className="mt-1 line-clamp-2 text-xs text-text-muted">{item.excerpt}</p>
                  </div>
                  <span className="mt-4 font-mono text-xs text-brand-soft">Read story &rarr;</span>
                </Link>
              ))}
            </div>
          </footer>
        )}
      </article>
    </div>
  );
}

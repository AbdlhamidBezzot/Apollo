import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us - Apollo",
  description:
    "Learn about Apollo, our mission to transform media discovery through legal content aggregation, AI recommendation engines, and editorial cinema guides.",
  alternates: {
    canonical: "https://www.missapollo.me/about",
  },
  openGraph: {
    title: "About Us - Apollo",
    description: "Learn about Apollo, our mission to transform media discovery.",
    url: "https://www.missapollo.me/about",
    siteName: "Apollo",
    type: "website",
  },
};


export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg-void px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Header Hero */}
        <section className="text-center">
          <span className="inline-block rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-brand-soft">
            Legal Content Aggregator & Discovery Engine
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-text-vivid sm:text-5xl lg:text-6xl">
            Redefining How You Experience Cinema<span className="text-brand">.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-text-muted sm:text-lg">
            Apollo is a modern, AI-powered streaming hub engineered to consolidate movie metadata, legal streaming provider options, and editorial insights into a single seamless experience.
          </p>
        </section>

        {/* Feature Cards Grid */}
        <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="glass rounded-3xl p-6 shadow-glass">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand-soft">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text-vivid">AI-Driven Discovery</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              Powered by CinemaOS AI, Apollo analyzes tone, mood, pacing, and story arcs to help users discover exactly what to watch without endless scrolling.
            </p>
          </div>

          <div className="glass rounded-3xl p-6 shadow-glass">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand-soft">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text-vivid">100% Legal Aggregation</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              We track content across official streaming services—such as Netflix, Prime Video, Apple TV+, Disney+, and Hulu—connecting viewers directly to verified legal sources.
            </p>
          </div>

          <div className="glass rounded-3xl p-6 shadow-glass">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand-soft">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text-vivid">Synchronized Movie Nights</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              Watch together in real-time with friend rooms, shared playback synchronization, interactive polls, and live chat.
            </p>
          </div>

          <div className="glass rounded-3xl p-6 shadow-glass">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand-soft">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text-vivid">Original Editorial Content</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              In-depth film analyses, genre breakdown guides, anime filler guides, and curated watchlists written by passionate cinema curators.
            </p>
          </div>
        </section>

        {/* Detailed Narrative Section */}
        <section className="glass space-y-6 rounded-3xl p-8 shadow-glass leading-relaxed text-text-muted">
          <h2 className="text-2xl font-extrabold text-text-vivid">Our Story & Mission</h2>
          <p>
            The modern streaming landscape is fragmented. With dozens of subscription platforms, viewers spend more time deciding what to watch than actually enjoying cinema. Apollo was built to solve this friction.
          </p>
          <p>
            By combining high-resolution metadata from open database APIs, direct deep links to official streaming platforms, and proprietary editorial reviews, Apollo acts as a comprehensive portal for film and television enthusiasts worldwide.
          </p>

          <h3 className="text-xl font-bold text-text-vivid pt-4">Content Aggregation Disclaimer</h3>
          <p>
            Apollo operates strictly as an informational index and content aggregator. We do not host, store, or upload copyrighted video files on our infrastructure. All video players, trailers, and streaming provider references belong to their respective copyright holders and official streaming platforms.
          </p>
        </section>

        {/* Call to action */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-brand/10 p-6 sm:p-8">
          <div>
            <h3 className="text-xl font-extrabold text-white">Explore Our Editorial Guides</h3>
            <p className="mt-1 text-sm text-text-muted">Read expert reviews, genre breakdowns, and curated watch lists.</p>
          </div>
          <Link
            href="/editorial"
            className="rounded-full bg-brand px-6 py-3 text-sm font-bold text-white shadow-brand-glow hover:bg-brand-soft"
          >
            Read Editorial Hub &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Apollo",
  description:
    "Find answers to common questions about Apollo's movie discovery engine, legal content aggregation, AI movie night features, and streaming providers.",
};

const FAQS = [
  {
    q: "What is Apollo?",
    a: "Apollo is a modern, next-generation streaming discovery platform and content aggregator. We bring together movie and TV show metadata, streaming availability across major providers (such as Netflix, Prime Video, Apple TV+), original editorial reviews, and an AI companion to help you decide what to watch.",
  },
  {
    q: "Is Apollo legal and free to browse?",
    a: "Yes! Apollo is 100% legal. We do not host or upload pirated video media. Instead, we index metadata, provide editorial commentary, and link users to verified legal streaming providers and authorized video sources.",
  },
  {
    q: "How does CinemaOS AI work?",
    a: "CinemaOS AI is our specialized recommendation companion. By analyzing film tropes, director styles, pacing, and viewer preferences, CinemaOS AI helps you build personalized movie night schedules, filter out anime filler episodes, and find hidden gems across all major platforms.",
  },
  {
    q: "What is the Movie Night Room?",
    a: "Movie Night Room allows you to create virtual watch rooms to sync playback, host real-time group polls, and chat with friends while deciding what to watch together.",
  },
  {
    q: "Where does Apollo get its movie metadata and images?",
    a: "All metadata, title cast details, artwork, and streaming availability are legally aggregated using public API endpoints from TMDB and JustWatch databases in compliance with standard API terms.",
  },
  {
    q: "How can I contact Apollo for DMCA or editorial requests?",
    a: "You can submit DMCA notices, editorial feedback, or general support questions directly through our Contact & Support portal.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-bg-void px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-10">
        <header className="text-center">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-soft">Help & Knowledge Base</span>
          <h1 className="mt-2 text-3xl font-extrabold text-text-vivid sm:text-4xl">Frequently Asked Questions</h1>
          <p className="mt-2 text-sm text-text-muted">
            Everything you need to know about Apollo, our AI discovery features, and content indexing.
          </p>
        </header>

        <div className="space-y-4">
          {FAQS.map((faq, i) => (
            <div key={i} className="glass rounded-3xl p-6 shadow-glass space-y-2">
              <h2 className="text-lg font-bold text-text-vivid flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-extrabold text-brand-soft">
                  Q{i + 1}
                </span>
                {faq.q}
              </h2>
              <p className="pl-10 text-sm leading-relaxed text-text-muted">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="text-center pt-4">
          <p className="text-sm text-text-muted">
            Still have questions? <Link href="/contact" className="font-bold text-brand-soft hover:underline">Contact our support team</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

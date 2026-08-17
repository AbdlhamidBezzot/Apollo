import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Apollo",
  description:
    "Apollo Terms of Service outline acceptable site usage, content indexing disclaimers, intellectual property notices, and DMCA takedown policies.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-bg-void px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-brand-soft">Legal Terms</p>
          <h1 className="mt-2 text-3xl font-extrabold text-text-vivid sm:text-4xl">Terms of Service</h1>
          <p className="mt-2 text-sm text-text-muted">Effective Date: August 17, 2026</p>
        </header>

        <main className="glass space-y-6 rounded-3xl p-6 sm:p-10 text-sm leading-relaxed text-text-muted shadow-glass">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-text-vivid">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Apollo (the "Site"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, you must not use or access this Site.
            </p>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-6">
            <h2 className="text-xl font-bold text-text-vivid">2. Content Aggregator & Indexing Disclaimer</h2>
            <p>
              Apollo operates solely as an indexer and aggregator of public media metadata, streaming options, and third-party media embeds.
            </p>
            <div className="rounded-2xl border border-brand/30 bg-brand/10 p-4 text-text-vivid">
              <strong className="block text-brand-soft mb-1">Important Notice:</strong>
              Apollo does not host, upload, or store video media files on its servers. All media items are sourced from public API directories or embedded third-party video networks. For copyright inquiries, please contact the original hosting source or use our DMCA notification channel.
            </div>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-6">
            <h2 className="text-xl font-bold text-text-vivid">3. Intellectual Property Rights</h2>
            <p>
              All original editorial text, articles, site layouts, CinemaOS software code, logos, and custom graphics created by Apollo are protected by intellectual property laws. Movie posters, titles, logos, and trademarks belong to their respective studios and rights owners.
            </p>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-6">
            <h2 className="text-xl font-bold text-text-vivid">4. User Account & Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Attempt to disrupt, exploit, or bypass site security or API rate limits.</li>
              <li>Scrape or reverse engineer proprietary search and AI recommendation algorithms.</li>
              <li>Use the synchronized Movie Night Room features for illegal broadcast or harassment.</li>
            </ul>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-6">
            <h2 className="text-xl font-bold text-text-vivid">5. DMCA & Copyright Takedown Procedure</h2>
            <p>
              Apollo complies with the Digital Millennium Copyright Act (DMCA). If you believe your copyrighted work is accessible on or through Apollo in a way that constitutes copyright infringement, please submit a detailed takedown notice via our <Link href="/contact" className="text-brand-soft hover:underline">Contact & DMCA Portal</Link>.
            </p>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-6">
            <h2 className="text-xl font-bold text-text-vivid">6. Disclaimer of Warranties & Limitation of Liability</h2>
            <p>
              The Site and all content are provided on an "as is" and "as available" basis without warranty of any kind. Apollo shall not be liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use the site.
            </p>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-6">
            <h2 className="text-xl font-bold text-text-vivid">7. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable laws without regard to conflict of law principles.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}

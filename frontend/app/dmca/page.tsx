import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "DMCA Copyright Notice & Policy - Apollo",
  description:
    "Apollo DMCA Notice and Takedown Policy. Read about our legal content indexing guidelines, copyright compliance, and how to submit a DMCA takedown request.",
  alternates: {
    canonical: "https://www.missapollo.me/dmca",
  },
  openGraph: {
    title: "DMCA Copyright Notice & Policy - Apollo",
    description: "Apollo DMCA Notice and Takedown Policy guidelines.",
    url: "https://www.missapollo.me/dmca",
    siteName: "Apollo",
    type: "website",
  },
};

export default function DMCAPage() {
  return (
    <div className="min-h-screen bg-[#09090B] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-white/60">Legal &amp; Copyright</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">DMCA Notice &amp; Takedown Policy</h1>
          <p className="mt-2 text-sm text-[#A1A1AA]">Last updated: August 2026</p>
        </header>

        <main className="space-y-6 rounded-3xl border border-white/10 bg-[#121215]/60 p-6 sm:p-10 text-sm leading-relaxed text-[#A1A1AA] backdrop-blur-xl">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-white">1. Overview &amp; Content Aggregation Statement</h2>
            <p>
              Apollo Hub (&quot;Apollo&quot;) operates strictly as an information aggregator and media catalog index. Apollo does not host, upload, store, or stream copyrighted video media files on its servers or database.
            </p>
            <p>
              All video content, trailers, artwork, posters, and metadata displayed or linked on Apollo are indexed from public API directories (such as TMDB, JustWatch, and public third-party video providers) in compliance with standard fair use and legal indexing practices.
            </p>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-6">
            <h2 className="text-xl font-bold text-white">2. DMCA Compliance</h2>
            <p>
              Apollo respects the intellectual property rights of creators, content owners, and studios. In accordance with the Digital Millennium Copyright Act (17 U.S.C. § 512, &quot;DMCA&quot;), Apollo will respond promptly to valid written notices of alleged copyright infringement.
            </p>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-6">
            <h2 className="text-xl font-bold text-white">3. How to Submit a DMCA Takedown Notice</h2>
            <p>
              If you are a copyright owner (or an authorized agent representing the copyright owner) and believe that any content indexed on Apollo infringes upon your copyright, please send a formal written notification containing the following details:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[#A1A1AA]">
              <li>
                <strong className="text-white">Identification of the copyrighted work:</strong> Clear identification of the copyrighted title or material claimed to have been infringed.
              </li>
              <li>
                <strong className="text-white">Identification of the infringing material:</strong> The specific URL(s) or page location on Apollo where the material is located.
              </li>
              <li>
                <strong className="text-white">Your Contact Information:</strong> Your full name, organization/company, physical address, telephone number, and official email address.
              </li>
              <li>
                <strong className="text-white">Good Faith Statement:</strong> A statement that you have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.
              </li>
              <li>
                <strong className="text-white">Accuracy &amp; Perjury Statement:</strong> A statement, under penalty of perjury, that the information in the notification is accurate and that you are authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.
              </li>
              <li>
                <strong className="text-white">Signature:</strong> A physical or electronic signature of the copyright owner or authorized representative.
              </li>
            </ul>
          </section>

          <section className="space-y-4 border-t border-white/10 pt-6">
            <h2 className="text-xl font-bold text-white">4. DMCA Agent Contact Information</h2>
            <p>Please send all legal DMCA notices to our designated copyright agent:</p>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-1">
              <p className="font-bold text-white">Apollo Legal &amp; Copyright Department</p>
              <p className="text-xs text-[#A1A1AA]">Email: <a href="mailto:dmca@missapollo.me" className="text-white font-semibold underline">dmca@missapollo.me</a></p>
              <p className="text-xs text-[#A1A1AA]">Web Portal: <Link href="/contact" className="text-white font-semibold underline">Apollo Contact &amp; DMCA Portal</Link></p>
            </div>
            <p className="text-xs text-[#A1A1AA]">
              Note: Notices that do not include the required information outlined above may delay processing or prevent action from being taken.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy - Apollo",
  description:
    "Apollo's Privacy Policy explains how we collect, use, and safeguard your data, including advertising cookies, analytics, and user privacy rights.",
  alternates: {
    canonical: "https://www.missapollo.me/privacy",
  },
  openGraph: {
    title: "Privacy Policy - Apollo",
    description: "Apollo's Privacy Policy explains how we safeguard your data.",
    url: "https://www.missapollo.me/privacy",
    siteName: "Apollo",
    type: "website",
  },
};


export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-bg-void px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-brand-soft">Legal Compliance</p>
          <h1 className="mt-2 text-3xl font-extrabold text-text-vivid sm:text-4xl">Privacy Policy</h1>
          <p className="mt-2 text-sm text-text-muted">Last updated: August 17, 2026</p>
        </header>

        <main className="glass space-y-6 rounded-3xl p-6 sm:p-10 text-sm leading-relaxed text-text-muted shadow-glass">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-text-vivid">1. Overview</h2>
            <p>
              At Apollo ("we", "us", or "our"), accessible from our website, protecting our visitors' privacy is one of our main priorities. This Privacy Policy document outlines the types of information collected and recorded by Apollo and how we use it.
            </p>
            <p>
              If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us at <Link href="/contact" className="text-brand-soft hover:underline">Apollo Contact Page</Link>.
            </p>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-6">
            <h2 className="text-xl font-bold text-text-vivid">2. Log Files & Technical Data</h2>
            <p>
              Apollo follows a standard procedure of using log files. These files log visitors when they visit websites. The information collected by log files includes internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks. These are not linked to any information that is personally identifiable. The purpose of the information is for analyzing trends, administering the site, tracking users' movement on the website, and gathering demographic information.
            </p>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-6">
            <h2 className="text-xl font-bold text-text-vivid">3. Cookies and Web Beacons</h2>
            <p>
              Like any other website, Apollo uses 'cookies'. These cookies are used to store information including visitors' preferences, watchlists, playback states, and the pages on the website that the visitor accessed or visited. The information is used to optimize the users' experience by customizing our web page content based on visitors' browser type and/or other information.
            </p>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-6">
            <h2 className="text-xl font-bold text-text-vivid">4. GDPR Data Protection Rights</h2>
            <p>We would like to make sure you are fully aware of all of your data protection rights. Every user is entitled to the following:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-text-vivid">The right to access</strong> – You have the right to request copies of your personal data.</li>
              <li><strong className="text-text-vivid">The right to rectification</strong> – You have the right to request that we correct any information you believe is inaccurate.</li>
              <li><strong className="text-text-vivid">The right to erasure</strong> – You have the right to request that we erase your personal data, under certain conditions.</li>
              <li><strong className="text-text-vivid">The right to restrict processing</strong> – You have the right to request that we restrict the processing of your personal data.</li>
            </ul>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-6">
            <h2 className="text-xl font-bold text-text-vivid">5. CCPA Privacy Rights (Do Not Sell My Personal Information)</h2>
            <p>Under the CCPA, California consumers have the right to request that a business disclose the categories and specific pieces of personal data collected, or request deletion of personal data. Apollo does not sell personal information to third parties.</p>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-6">
            <h2 className="text-xl font-bold text-text-vivid">6. Contact Us</h2>
            <p>
              If you have any questions regarding this Privacy Policy or wish to exercise your rights, please visit our <Link href="/contact" className="text-brand-soft hover:underline">Contact Page</Link>.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { HomeClient } from "@/components/HomeClient";

export const metadata: Metadata = {
  title: "Apollo - Movies & TV Shows",
  description: "Discover movies, TV shows, anime, popular releases, trending titles and more on Apollo.",
  alternates: {
    canonical: "https://www.missapollo.me",
  },
  openGraph: {
    title: "Apollo - Movies & TV Shows",
    description: "Discover movies, TV shows, anime, popular releases, trending titles and more on Apollo.",
    url: "https://www.missapollo.me",
    siteName: "Apollo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Apollo - Movies & TV Shows",
    description: "Discover movies, TV shows, anime, popular releases, trending titles and more on Apollo.",
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Apollo",
  alternateName: ["Apollo Movies & TV Shows", "Miss Apollo"],
  url: "https://www.missapollo.me",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://www.missapollo.me/search?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <HomeClient />
    </>
  );
}
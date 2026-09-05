import type { Metadata } from "next";
import { AnimeClient } from "@/components/AnimeClient";

export const metadata: Metadata = {
  title: "Anime - Apollo",
  description: "Watch and discover popular anime series, trending releases, and top-rated anime on Apollo.",
  alternates: {
    canonical: "https://www.missapollo.me/anime",
  },
  openGraph: {
    title: "Anime - Apollo",
    description: "Watch and discover popular anime series, trending releases, and top-rated anime on Apollo.",
    url: "https://www.missapollo.me/anime",
    siteName: "Apollo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Anime - Apollo",
    description: "Watch and discover popular anime series, trending releases, and top-rated anime on Apollo.",
  },
};

export default function AnimePage() {
  return <AnimeClient />;
}
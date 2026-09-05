import type { Metadata } from "next";
import { SportsClient } from "@/components/SportsClient";

export const metadata: Metadata = {
  title: "Live Sports - Apollo",
  description: "Watch live football streaming, scores, schedule, and match highlights on Apollo.",
  alternates: {
    canonical: "https://www.missapollo.me/sports",
  },
  openGraph: {
    title: "Live Sports - Apollo",
    description: "Watch live football streaming, scores, schedule, and match highlights on Apollo.",
    url: "https://www.missapollo.me/sports",
    siteName: "Apollo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Live Sports - Apollo",
    description: "Watch live football streaming and scores on Apollo.",
  },
};

export default function SportsPage() {
  return <SportsClient />;
}

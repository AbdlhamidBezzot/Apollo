import type { Metadata } from "next";
import { Suspense } from "react";
import Script from "next/script";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ChatBot } from "@/components/ChatBot";
import { MovieNightModal } from "@/components/MovieNightModal";
import { AuthProvider } from "@/components/AuthContext";
import { Footer } from "@/components/HomeEnhancements";
import { PopunderScript } from "@/components/PopunderScript";

import { Analytics } from "@vercel/analytics/next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.missapollo.me";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Apollo - Movies & TV Shows",
    template: "%s - Apollo",
  },
  description: "Discover movies, TV shows, anime, popular releases, trending titles and more on Apollo.",
  keywords: ["movies", "TV shows", "anime", "popular releases", "trending titles", "movie discovery", "Apollo"],
  authors: [{ name: "Apollo" }],
  creator: "Apollo",
  publisher: "Apollo",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "./",
  },
  openGraph: {
    title: "Apollo - Movies & TV Shows",
    description: "Discover movies, TV shows, anime, popular releases, trending titles and more on Apollo.",
    url: SITE_URL,
    siteName: "Apollo",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Apollo - Movies & TV Shows",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Apollo - Movies & TV Shows",
    description: "Discover movies, TV shows, anime, popular releases, trending titles and more on Apollo.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
  verification: {
    google: "IuiXeB01DppSggc0BiQhgl-71NEWZVszBHceQEdnPEs",
    other: {
      "261a0053ab087fd751570dafaaee649ad4114b60": ["261a0053ab087fd751570dafaaee649ad4114b60"],
    },
  },
  other: {
    "261a0053ab087fd751570dafaaee649ad4114b60": "261a0053ab087fd751570dafaaee649ad4114b60",
  },
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="261a0053ab087fd751570dafaaee649ad4114b60" content="261a0053ab087fd751570dafaaee649ad4114b60" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <Suspense fallback={null}>
            <Navbar />
          </Suspense>
          <main className="min-h-screen pb-8 lg:pl-24">{children}</main>
          <div className="lg:pl-24"><Footer /></div>
          <ChatBot />
          <MovieNightModal />
          <PopunderScript />
        </AuthProvider>
        <Analytics />
        <Script src="/hilltopads.js" strategy="afterInteractive" />
        <Script src="/multitag.js" strategy="afterInteractive" />
        <Script src="/inpage-push.js" strategy="afterInteractive" />
      </body>
    </html>

  );
}

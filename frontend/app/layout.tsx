import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import Script from "next/script";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ChatBot } from "@/components/ChatBot";
import { MovieNightModal } from "@/components/MovieNightModal";
import { AuthProvider } from "@/components/AuthContext";
import { ThemeProvider } from "@/components/ThemeContext";
import { Footer } from "@/components/HomeEnhancements";
import { Analytics } from "@vercel/analytics/next";
import { PlayerProvider } from "@/lib/playerContext";
import { GlobalPlayer } from "@/components/player/GlobalPlayer";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.missapollo.me";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#09090b",
};

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
      "6a97888e-site-verification": ["d10dde179d8ec2d925c8340a9c294592"],
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Google tag (gtag.js) */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-8YNTW2H5TN" strategy="afterInteractive" />
        <Script id="google-gtag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-8YNTW2H5TN');
          `}
        </Script>
        <meta name="6a97888e-site-verification" content="d10dde179d8ec2d925c8340a9c294592" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <PlayerProvider>
          <ThemeProvider>
            <AuthProvider>
              <Suspense fallback={null}>
                <Navbar />
              </Suspense>

              <main className="min-h-screen pb-8 pt-16">
                {children}
              </main>

              <footer>
                <Footer />
              </footer>

              <ChatBot />
              <MovieNightModal />

              {/* Global player — single <video> element, persists across navigation */}
              <Suspense fallback={null}>
                <GlobalPlayer />
              </Suspense>
            </AuthProvider>
          </ThemeProvider>
        </PlayerProvider>
        <Analytics />
      </body>
    </html>
  );
}

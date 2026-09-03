import type { Metadata } from "next";
import { Suspense } from "react";
import Script from "next/script";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ChatBot } from "@/components/ChatBot";
import { MovieNightModal } from "@/components/MovieNightModal";
import { AuthProvider } from "@/components/AuthContext";
import { Footer } from "@/components/HomeEnhancements";
import { NativeBanner } from "@/components/NativeBanner";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Apollo - Movies & Series",
  description: "Legal movie & series discovery, with an AI companion that plans your movie night.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
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
          {/* Adsterra: Native Banner – anywhere in body */}
          <NativeBanner />
          <div className="lg:pl-24"><Footer /></div>
          <ChatBot />
          <MovieNightModal />
        </AuthProvider>
        <Analytics />

        {/* ── Adsterra: Popunder & Social Bar (Production Only) ── */}
        {process.env.NODE_ENV === "production" && (
          <>
            {/* Popunder disabled temporarily:
            <Script
              src="https://heavenlysuspicious.com/25/ea/fd/25eafdc0d5b5c73fff96db5f26b3fd80.js"
              strategy="lazyOnload"
            />
            */}
            <Script
              src="https://pl31098603.profitableratecpmnetwork.com/a7/af/9d/a7af9dd53724b72f361ecca2360aad8a.js"
              strategy="lazyOnload"
            />
          </>
        )}
      </body>
    </html>

  );
}

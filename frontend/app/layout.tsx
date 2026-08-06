import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ChatBot } from "@/components/ChatBot";
import { MovieNightModal } from "@/components/MovieNightModal";
import { AuthProvider } from "@/components/AuthContext";
import { Footer } from "@/components/HomeEnhancements";

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
          <div className="lg:pl-24"><Footer /></div>
          <ChatBot />
          <MovieNightModal />
        </AuthProvider>
      </body>
    </html>
  );
}

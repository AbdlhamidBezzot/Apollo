"use client";

import { Suspense, useEffect } from "react";
import { MobileBottomNav } from "./MobileBottomNav";
import { useIsMobile } from "@/lib/useIsMobile";

export function MobileLayoutShell({ children }: { children: React.ReactNode }) {
  const { isMobile, mounted } = useIsMobile();

  // Apply/remove a body class so CSS can hide desktop chrome on mobile
  useEffect(() => {
    if (!mounted) return;
    if (isMobile) {
      document.body.classList.add("is-mobile-app");
    } else {
      document.body.classList.remove("is-mobile-app");
    }
    return () => {
      document.body.classList.remove("is-mobile-app");
    };
  }, [isMobile, mounted]);

  if (!mounted) {
    // SSR/first render — pass through unchanged to avoid layout shift
    return <>{children}</>;
  }

  if (!isMobile) {
    // Desktop: no mobile chrome, pass through unchanged
    return <>{children}</>;
  }

  // Mobile / Capacitor native: strip desktop chrome, add bottom nav
  return (
    <div className="relative flex flex-col min-h-screen bg-[#09090B]">
      {/* Main content — bottom padding accounts for fixed bottom nav + safe area */}
      <div
        className="flex-1"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 64px)" }}
      >
        {children}
      </div>

      {/* Fixed Mobile Bottom Navigation */}
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </div>
  );
}

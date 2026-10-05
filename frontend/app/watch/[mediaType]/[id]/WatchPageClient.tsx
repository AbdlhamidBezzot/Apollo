"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { WatchClient } from "@/components/WatchClient";

export function WatchPageClient() {
  const params = useParams();
  const rawMediaType = (params?.mediaType as string) || "movie";
  const mediaType = rawMediaType === "tv" ? "tv" : "movie";
  const rawId = (params?.id as string) || "0";
  const id = Number(rawId) || 0;

  return (
    /* On mobile the player fills the full viewport height starting from safe-area-top.
       We cancel the root layout's pt-16 on the watch page for mobile only. */
    <div className="watch-page-root">
      <Suspense
        fallback={
          <div className="watch-page-root">
            {/* Mobile skeleton */}
            <div className="aspect-video w-full bg-white/5 animate-pulse md:hidden" />
            {/* Desktop skeleton */}
            <div className="mx-auto hidden max-w-5xl px-4 py-12 md:block">
              <div className="skeleton mb-3 h-8 w-64 rounded" />
              <div className="skeleton aspect-video w-full rounded-xl" />
            </div>
          </div>
        }
      >
        <WatchClient mediaType={mediaType} id={id} />
      </Suspense>
    </div>
  );
}


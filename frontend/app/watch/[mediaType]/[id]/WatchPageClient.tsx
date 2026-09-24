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
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="skeleton mb-3 h-8 w-64 rounded" />
          <div className="skeleton aspect-video w-full rounded-xl" />
        </div>
      }
    >
      <WatchClient mediaType={mediaType} id={id} />
    </Suspense>
  );
}

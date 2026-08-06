import { Suspense } from "react";
import { WatchClient } from "@/components/WatchClient";

export default async function WatchPage({ params }: { params: Promise<{ mediaType: string; id: string }> }) {
  const { mediaType, id } = await params;
  const mt = mediaType === "tv" ? "tv" : "movie";
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="skeleton mb-3 h-8 w-64 rounded" />
          <div className="skeleton aspect-video w-full rounded-xl" />
        </div>
      }
    >
      <WatchClient mediaType={mt} id={Number(id)} />
    </Suspense>
  );
}
import type { Metadata } from "next";
import { Suspense } from "react";
import { WatchClient } from "@/components/WatchClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mediaType: string; id: string }>;
}): Promise<Metadata> {
  const { mediaType, id } = await params;
  return {
    title: `Watch Player - Apollo`,
    robots: {
      index: false,
      follow: false,
    },
    alternates: {
      canonical: `https://www.missapollo.me/${mediaType === "tv" ? "tv" : "movie"}/${id}`,
    },
  };
}

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
"use client";

import { useSearchParams } from "next/navigation";
import { BrowseClient, type BrowseParams } from "@/components/BrowseClient";

export function BrowseWithParams({
  defaultMediaType,
  genres,
}: {
  defaultMediaType?: string;
  genres: { id: number; name: string }[];
}) {
  const searchParams = useSearchParams();
  const initial: Partial<BrowseParams> = defaultMediaType ? { media_type: defaultMediaType } : {};

  for (const key of ["media_type", "genre", "year", "min_rating", "sort_by", "kind", "language", "country"] as const) {
    const val = searchParams.get(key);
    if (val) initial[key] = val;
  }

  return <BrowseClient initial={initial} genres={genres} />;
}

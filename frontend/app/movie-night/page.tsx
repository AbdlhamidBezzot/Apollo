import { Suspense } from "react";
import { MovieNightRoomClient } from "@/components/MovieNightRoom";

export default function MovieNightPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-text-muted">Loading…</div>}>
      <MovieNightRoomClient />
    </Suspense>
  );
}
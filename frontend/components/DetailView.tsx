// Server Component — do NOT add "use client" here.
import { DetailViewClient } from "@/components/DetailViewClient";
import { get } from "@/lib/http";
import type { ContentListResponse, Title, TitleDetail } from "@/lib/types";

export async function DetailView({ mediaType, id }: { mediaType: "movie" | "tv"; id: number }) {
  let item: TitleDetail | null = null;
  let similar: Title[] = [];

  try {
    const [detail, sim] = await Promise.all([
      get<TitleDetail>(`/api/v1/content/${mediaType}/${id}`),
      get<ContentListResponse>(`/api/v1/content/${mediaType}/${id}/similar`).catch(() => null),
    ]);
    item = detail;
    similar = (sim?.results || []).slice(0, 12).map((t) => ({ ...t, media_type: mediaType }));
  } catch {
    /* fall through */
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center text-text-muted">
        <h1 className="mb-2 text-2xl font-extrabold text-text-vivid">Title not found</h1>
        <p>The backend may be offline or TMDB returned an error. Try again in a moment.</p>
      </div>
    );
  }

  return <DetailViewClient item={item} similar={similar} mediaType={mediaType} />;
}

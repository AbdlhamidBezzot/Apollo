// Server Component — do NOT add "use client" here.
import { DetailViewClient } from "@/components/DetailViewClient";
import { ErrorScreen } from "@/components/ErrorScreen";
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
      <ErrorScreen
        title="Title not found"
        message="We couldn't load this title right now. Please try again in a moment."
      />
    );
  }

  return <DetailViewClient item={item} similar={similar} mediaType={mediaType} />;
}

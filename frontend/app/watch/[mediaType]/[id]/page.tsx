import { WatchClient } from "@/components/WatchClient";

export default async function WatchPage({ params }: { params: Promise<{ mediaType: string; id: string }> }) {
  const { mediaType, id } = await params;
  const mt = mediaType === "tv" ? "tv" : "movie";
  return <WatchClient mediaType={mt} id={Number(id)} />;
}

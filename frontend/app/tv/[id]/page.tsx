import { DetailView } from "@/components/DetailView";

export default async function TvPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DetailView mediaType="tv" id={Number(id)} />;
}

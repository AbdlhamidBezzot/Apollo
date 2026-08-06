import { DetailView } from "@/components/DetailView";

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DetailView mediaType="movie" id={Number(id)} />;
}

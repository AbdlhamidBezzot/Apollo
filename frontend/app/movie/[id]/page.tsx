import { DetailView } from "@/components/DetailView";

export async function generateStaticParams() {
  return [{ id: "0" }];
}

export default function MoviePage() {
  return <DetailView mediaType="movie" />;
}

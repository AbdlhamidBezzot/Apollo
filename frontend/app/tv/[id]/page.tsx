import { DetailView } from "@/components/DetailView";

export async function generateStaticParams() {
  return [{ id: "0" }];
}

export default function TvPage() {
  return <DetailView mediaType="tv" />;
}

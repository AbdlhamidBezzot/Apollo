import { WatchPageClient } from "./WatchPageClient";

export async function generateStaticParams() {
  return [
    { mediaType: "movie", id: "0" },
    { mediaType: "tv", id: "0" },
  ];
}

export default function WatchPage() {
  return <WatchPageClient />;
}
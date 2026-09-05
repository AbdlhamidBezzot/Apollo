import type { Metadata } from "next";
import { MyListClient } from "@/components/MyListClient";

export const metadata: Metadata = {
  title: "My List - Apollo",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MyListPage() {
  return <MyListClient />;
}

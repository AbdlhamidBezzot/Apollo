import type { Metadata } from "next";
import { HistoryClient } from "@/components/HistoryClient";

export const metadata: Metadata = {
  title: "Viewing History - Apollo",
  robots: {
    index: false,
    follow: false,
  },
};

export default function HistoryPage() {
  return <HistoryClient />;
}

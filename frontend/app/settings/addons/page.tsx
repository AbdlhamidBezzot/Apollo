import type { Metadata } from "next";
import { AddonsClient } from "@/components/AddonsClient";

export const metadata: Metadata = {
  title: "Add-ons Settings - Apollo",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AddonsPage() {
  return <AddonsClient />;
}

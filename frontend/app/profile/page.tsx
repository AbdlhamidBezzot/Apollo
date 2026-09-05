import type { Metadata } from "next";
import { ProfileClient } from "@/components/ProfileClient";

export const metadata: Metadata = {
  title: "Account Settings - Apollo",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfilePage() {
  return <ProfileClient />;
}

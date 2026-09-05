import type { Metadata } from "next";
import { LoginClient } from "@/components/LoginClient";

export const metadata: Metadata = {
  title: "Sign In - Apollo",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return <LoginClient />;
}

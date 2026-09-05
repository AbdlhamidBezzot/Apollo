import type { Metadata } from "next";
import { ContactClient } from "@/components/ContactClient";

export const metadata: Metadata = {
  title: "Contact Us - Apollo",
  description: "Have questions, feedback, or DMCA copyright inquiries? Contact the Apollo support team.",
  alternates: {
    canonical: "https://www.missapollo.me/contact",
  },
  openGraph: {
    title: "Contact Us - Apollo",
    description: "Have questions, feedback, or DMCA copyright inquiries? Contact Apollo support.",
    url: "https://www.missapollo.me/contact",
    siteName: "Apollo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Us - Apollo",
    description: "Have questions, feedback, or DMCA copyright inquiries? Contact Apollo support.",
  },
};

export default function ContactPage() {
  return <ContactClient />;
}

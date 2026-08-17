import type { MetadataRoute } from "next";
import { EDITORIAL_ARTICLES } from "@/lib/editorial-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://apollo-stream.com";

  // Static routes
  const staticRoutes = [
    "",
    "/about",
    "/privacy",
    "/terms",
    "/contact",
    "/faq",
    "/editorial",
    "/browse",
    "/anime",
    "/my-list",
    "/movie-night",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: route === "" ? 1.0 : 0.8,
  }));

  // Editorial article routes
  const articleRoutes = EDITORIAL_ARTICLES.map((article) => ({
    url: `${baseUrl}/editorial/${article.slug}`,
    lastModified: new Date(article.publishedAt),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  return [...staticRoutes, ...articleRoutes];
}

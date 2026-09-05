import type { MetadataRoute } from "next";
import { EDITORIAL_ARTICLES } from "@/lib/editorial-data";
import { get } from "@/lib/http";
import type { ContentListResponse, Title } from "@/lib/types";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.missapollo.me";
  const now = new Date();

  // Static indexable routes
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/movies`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/tv`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/anime`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/browse`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/editorial`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/sports`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  // Editorial articles
  const articleRoutes: MetadataRoute.Sitemap = EDITORIAL_ARTICLES.map((article) => ({
    url: `${baseUrl}/editorial/${article.slug}`,
    lastModified: new Date(article.publishedAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Dynamic movie and TV detail routes (safely fetched with fallback)
  let dynamicDetailRoutes: MetadataRoute.Sitemap = [];
  try {
    const [trendingMovies, trendingTv] = await Promise.all([
      get<ContentListResponse>("/api/v1/content/popular?media_type=movie").catch(() => null),
      get<ContentListResponse>("/api/v1/content/popular?media_type=tv").catch(() => null),
    ]);

    const movies = (trendingMovies?.results || []).slice(0, 50);
    const shows = (trendingTv?.results || []).slice(0, 50);

    const movieUrls: MetadataRoute.Sitemap = movies.map((item: Title) => ({
      url: `${baseUrl}/movie/${item.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    const showUrls: MetadataRoute.Sitemap = shows.map((item: Title) => ({
      url: `${baseUrl}/tv/${item.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    dynamicDetailRoutes = [...movieUrls, ...showUrls];
  } catch {
    /* backend unreachable during build - fallback cleanly to static routes */
  }

  return [...staticRoutes, ...articleRoutes, ...dynamicDetailRoutes];
}

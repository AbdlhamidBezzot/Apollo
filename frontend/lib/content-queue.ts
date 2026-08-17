import { EDITORIAL_ARTICLES, type EditorialArticle } from "@/lib/editorial-data";

export interface QueueItem {
  id: string;
  type: "article" | "editorial_take";
  payload: Record<string, unknown>;
  status: "queued" | "published";
  created_at: string;
  published_at?: string | null;
}

// In-memory / persistent queue state simulation for Vercel serverless deployment
let QUEUED_ITEMS: QueueItem[] = [
  // Queue additional upcoming articles for staggered release
  {
    id: "art-1",
    type: "article",
    payload: {
      slug: "future-of-cinema-ai-storytelling",
      title: "The Future of Cinema: How Generative AI is Reshaping Indie Film Production",
      subtitle: "Independent directors are leveraging neural tools for virtual scouting, pre-visualization, and micro-budget visual effects.",
      category: "AI Insights",
      author: {
        name: "Dr. Aris Thorne",
        role: "Lead AI Systems Architect",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
      },
      readTime: "9 min read",
      coverImage: "https://image.tmdb.org/t/p/w1280/8Z8d8ZSpv6zdaI3qugR20yGIrmE.jpg",
      excerpt: "Virtual production and neural pre-visualization are democratizing high-concept sci-fi filmmaking for independent directors.",
    },
    status: "queued",
    created_at: new Date().toISOString(),
    published_at: null,
  },
  {
    id: "art-2",
    type: "article",
    payload: {
      slug: "top-neo-noir-thrillers-decade",
      title: "Shadows and Neon: The 8 Best Neo-Noir Thrillers of the 2020s",
      subtitle: "Rain-slicked asphalt, morally gray detectives, and suffocating tension—exploring modern noir cinema.",
      category: "Guides",
      author: {
        name: "Marcus Vance",
        role: "Senior Film Critic",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      },
      readTime: "10 min read",
      coverImage: "https://image.tmdb.org/t/p/w1280/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
      excerpt: "Neo-noir continues to evolve, infusing classic hardboiled archetypes with modern tech paranoia and haunting acoustic scores.",
    },
    status: "queued",
    created_at: new Date().toISOString(),
    published_at: null,
  },
];

/**
 * Returns all currently published articles.
 */
export function getPublishedArticles(): EditorialArticle[] {
  // Return published articles from EDITORIAL_ARTICLES plus any dynamically published items
  const publishedFromQueue = QUEUED_ITEMS.filter((i) => i.status === "published" && i.type === "article").map(
    (i) => i.payload as unknown as EditorialArticle
  );

  return [...EDITORIAL_ARTICLES, ...publishedFromQueue];
}

/**
 * Publishes a batch of queued items (called by Vercel Cron route).
 */
export async function publishBatch(batchSize = 5): Promise<{
  success: boolean;
  publishedCount: number;
  items: QueueItem[];
}> {
  const now = new Date().toISOString();
  const queued = QUEUED_ITEMS.filter((i) => i.status === "queued").slice(0, batchSize);

  for (const item of queued) {
    item.status = "published";
    item.published_at = now;
  }

  return {
    success: true,
    publishedCount: queued.length,
    items: queued,
  };
}

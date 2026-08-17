import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { publishBatch } from "@/lib/content-queue";

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

async function handleCron(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const headerSecret = req.headers.get("x-cron-secret");

  // In production, enforce bearer token or header verification against CRON_SECRET
  if (cronSecret) {
    const validBearer = authHeader === `Bearer ${cronSecret}`;
    const validHeader = headerSecret === cronSecret;

    if (!validBearer && !validHeader) {
      return NextResponse.json({ error: "Unauthorized cron execution" }, { status: 401 });
    }
  }

  try {
    const result = await publishBatch(5);

    // Trigger dynamic path revalidation for fresh sitemap and editorial index
    revalidatePath("/editorial");
    revalidatePath("/sitemap.xml");

    return NextResponse.json({
      success: true,
      published_count: result.publishedCount,
      published_items: result.items,
      executed_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Cron execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

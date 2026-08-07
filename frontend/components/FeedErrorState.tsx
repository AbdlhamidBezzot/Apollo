import { ApiIssue } from "@/lib/errors";

export function FeedErrorState({ issue }: { issue: ApiIssue }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center text-text-muted">
      <h1 className="mb-2 text-2xl font-extrabold text-text-vivid">{issue.title}</h1>
      <p className="text-sm leading-relaxed">{issue.message}</p>
      <p className="mt-4 text-xs uppercase tracking-wide text-text-muted/70">
        Want to fix it yourself? Check that the backend is deployed and NEXT_PUBLIC_API_URL on
        Vercel points to it.
      </p>
    </div>
  );
}
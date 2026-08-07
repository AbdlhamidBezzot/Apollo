"use client";

import { ErrorScreen } from "@/components/ErrorScreen";
import { ApiIssue } from "@/lib/errors";

export function FeedErrorState({ issue, onRetry }: { issue: ApiIssue; onRetry?: () => void }) {
  return <ErrorScreen title={issue.title} message={issue.message} onRetry={onRetry} />;
}
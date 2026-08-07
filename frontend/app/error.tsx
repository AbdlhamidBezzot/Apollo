"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/ErrorScreen";
import { classifyError, logTechnicalDetail } from "@/lib/errors";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const issue = classifyError(error);
    logTechnicalDetail(issue, error.digest ? `Digest: ${error.digest}` : undefined);
  }, [error]);

  const issue = classifyError(error);

  return (
    <ErrorScreen
      title={issue.title}
      message={issue.message}
      onRetry={reset}
    />
  );
}

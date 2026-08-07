"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/ErrorScreen";
import { classifyError, logTechnicalDetail } from "@/lib/errors";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const issue = classifyError(error);
    logTechnicalDetail(issue, error.digest ? `Root Digest: ${error.digest}` : undefined);
  }, [error]);

  const issue = classifyError(error);

  return (
    <html lang="en" className="dark">
      <body className="bg-bg-dark text-text-vivid antialiased min-h-screen">
        <ErrorScreen
          title={issue.title}
          message={issue.message}
          onRetry={reset}
        />
      </body>
    </html>
  );
}

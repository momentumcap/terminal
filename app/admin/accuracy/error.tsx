"use client";

import { ErrorFallback } from "@/components/system/ErrorFallback";
import { useEffect } from "react";

export default function AccuracyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Accuracy dashboard route error", error);
  }, [error]);

  return (
    <ErrorFallback
      title="Accuracy dashboard failed to load"
      message="Provider health, freshness, or readiness telemetry did not render cleanly. Retry the dashboard before making a public-beta decision."
      reset={reset}
    />
  );
}

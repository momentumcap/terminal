"use client";

import { ErrorFallback } from "@/components/system/ErrorFallback";
import { useEffect } from "react";

export default function AdminFeedbackError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Admin feedback route error", error);
  }, [error]);

  return (
    <ErrorFallback
      title="Feedback triage failed to load"
      message="The beta feedback queue did not render cleanly. Retry it before making a public-beta readiness decision."
      reset={reset}
    />
  );
}

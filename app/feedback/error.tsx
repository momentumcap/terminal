"use client";

import { ErrorFallback } from "@/components/system/ErrorFallback";
import { useEffect } from "react";

export default function FeedbackError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Feedback route error", error);
  }, [error]);

  return (
    <ErrorFallback
      title="Feedback form failed to load"
      message="The issue report form did not render correctly. Retry the form, then use the accuracy dashboard if you are reporting a data problem."
      reset={reset}
    />
  );
}

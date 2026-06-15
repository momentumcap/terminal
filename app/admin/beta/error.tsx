"use client";

import { ErrorFallback } from "@/components/system/ErrorFallback";
import { useEffect } from "react";

export default function AdminBetaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Public beta checklist route error", error);
  }, [error]);

  return (
    <ErrorFallback
      title="Public beta checklist failed to load"
      message="The launch-readiness gate did not render cleanly. Retry it before making a beta release decision."
      reset={reset}
    />
  );
}

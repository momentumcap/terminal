"use client";

import { ErrorFallback } from "@/components/system/ErrorFallback";
import { useEffect } from "react";

export default function StatusError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Status route error", error);
  }, [error]);

  return (
    <ErrorFallback
      title="Status page failed to load"
      message="The user-facing provider and trust status page did not render cleanly. Retry it, then check the admin accuracy dashboard if the problem persists."
      reset={reset}
    />
  );
}

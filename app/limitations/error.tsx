"use client";

import { ErrorFallback } from "@/components/system/ErrorFallback";
import { useEffect } from "react";

export default function LimitationsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Limitations route error", error);
  }, [error]);

  return (
    <ErrorFallback
      title="Limitations page failed to load"
      message="The risk and limitations page did not render correctly. Refresh it before using the terminal in a public-beta context."
      reset={reset}
    />
  );
}

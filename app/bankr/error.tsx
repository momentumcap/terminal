"use client";

import { ErrorFallback } from "@/components/system/ErrorFallback";
import { useEffect } from "react";

export default function BankrError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Bankr scanner route error", error);
  }, [error]);

  return (
    <ErrorFallback
      title="Bankr scanner needs a refresh"
      message="The Bankr launch feed or one of its enrichment panels failed to render. Refresh this view before relying on launch categories or risk labels."
      reset={reset}
    />
  );
}

"use client";

import { ErrorFallback } from "@/components/system/ErrorFallback";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Momentum Terminal route error", error);
  }, [error]);

  return <ErrorFallback reset={reset} />;
}

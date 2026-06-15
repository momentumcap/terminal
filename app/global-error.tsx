"use client";

import { ErrorFallback } from "@/components/system/ErrorFallback";
import "./globals.css";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Momentum Terminal global error", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body>
        <ErrorFallback
          title="Momentum Terminal hit a critical error"
          message="The app shell failed to render. Retry once, then check provider and deployment health before continuing."
          reset={reset}
        />
      </body>
    </html>
  );
}

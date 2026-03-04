"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
        <h1 className="mb-2 text-xl font-semibold">Something went wrong</h1>
        <p className="mb-6 text-sm text-zinc-400">The error has been reported.</p>
        <button
          onClick={reset}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-100"
        >
          Try again
        </button>
      </body>
    </html>
  );
}

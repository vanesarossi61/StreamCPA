/**
 * Dashboard error boundary — catches errors in all /streamer, /brand, /admin routes
 *
 * Renders within the dashboard layout (sidebar + header stay visible)
 * so the user can navigate away from the broken page.
 */
"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="mx-auto max-w-md space-y-6 text-center">
        {/* Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <svg
            className="h-7 w-7 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">
            Page Error
          </h2>
          <p className="text-sm text-muted-foreground">
            Something went wrong loading this page. Your data is safe — try
            refreshing or navigate to another section.
          </p>
        </div>

        {/* Error info (dev only) */}
        {process.env.NODE_ENV === "development" && (
          <details className="rounded-md border bg-muted/50 p-3 text-left">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Error details
            </summary>
            <pre className="mt-2 overflow-auto text-xs text-destructive">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}

        {/* Error digest */}
        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Retry
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-5 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}

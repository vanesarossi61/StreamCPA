/**
 * Custom 404 page — shown when a route doesn't exist
 *
 * Matches the visual style of the error boundary pages.
 */
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md space-y-6 text-center">
        {/* 404 badge */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <span className="text-3xl font-bold text-muted-foreground">404</span>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Page not found
          </h1>
          <p className="text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
          <Link
            href="/marketplace"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Browse campaigns
          </Link>
        </div>
      </div>
    </div>
  );
}

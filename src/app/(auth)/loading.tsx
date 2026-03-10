/**
 * Auth pages loading state — shown while /login, /register load
 *
 * Centered card skeleton matching the auth form layout.
 */

export default function AuthLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-pulse space-y-6">
        {/* Logo placeholder */}
        <div className="mx-auto h-10 w-10 rounded-lg bg-muted" />

        {/* Title + subtitle */}
        <div className="space-y-2 text-center">
          <div className="mx-auto h-7 w-40 rounded bg-muted" />
          <div className="mx-auto h-4 w-56 rounded bg-muted" />
        </div>

        {/* Form card */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="space-y-4">
            {/* Email field */}
            <div className="space-y-2">
              <div className="h-4 w-12 rounded bg-muted" />
              <div className="h-10 w-full rounded-md bg-muted" />
            </div>
            {/* Password field */}
            <div className="space-y-2">
              <div className="h-4 w-16 rounded bg-muted" />
              <div className="h-10 w-full rounded-md bg-muted" />
            </div>
            {/* Submit button */}
            <div className="h-10 w-full rounded-md bg-muted" />
          </div>
        </div>

        {/* OAuth divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-muted" />
          <div className="h-4 w-8 rounded bg-muted" />
          <div className="h-px flex-1 bg-muted" />
        </div>

        {/* OAuth buttons */}
        <div className="space-y-3">
          <div className="h-10 w-full rounded-md bg-muted" />
          <div className="h-10 w-full rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}

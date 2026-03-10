/**
 * Dashboard loading state — shown while any dashboard page is loading
 *
 * Renders skeleton loaders that match the typical dashboard layout:
 * stats cards + table. Stays within the sidebar+header shell.
 */

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-md bg-muted" />
        <div className="h-4 w-72 rounded-md bg-muted" />
      </div>

      {/* Stats cards skeleton — 4 cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border bg-card p-6 shadow-sm"
          >
            <div className="space-y-3">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-7 w-16 rounded bg-muted" />
              <div className="h-3 w-32 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border bg-card shadow-sm">
        {/* Table header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="h-9 w-24 rounded bg-muted" />
        </div>
        {/* Table rows */}
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-3 w-24 rounded bg-muted" />
              </div>
              <div className="h-6 w-16 rounded-full bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

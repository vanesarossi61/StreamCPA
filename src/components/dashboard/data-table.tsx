"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ==========================================
// Types
// ==========================================

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  render?: (row: T, index: number) => React.ReactNode;
  // For default rendering when no render fn
  format?: "money" | "number" | "percent" | "date" | "datetime";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  // Pagination
  pageSize?: number;
  currentPage?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  // Server-side pagination
  serverSide?: boolean;
  // Sorting
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string, direction: "asc" | "desc") => void;
  // Search
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  // Selection
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  getRowId?: (row: T) => string;
  // Actions
  actions?: React.ReactNode;
  bulkActions?: (selectedIds: Set<string>) => React.ReactNode;
  // Row click
  onRowClick?: (row: T) => void;
  // Styling
  className?: string;
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  compact?: boolean;
}

// ==========================================
// DataTable component
// ==========================================

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  pageSize = 10,
  currentPage: controlledPage,
  totalItems: controlledTotal,
  onPageChange,
  serverSide = false,
  sortKey: controlledSortKey,
  sortDirection: controlledSortDir,
  onSort,
  searchable = false,
  searchPlaceholder = "Search...",
  onSearch,
  selectable = false,
  selectedIds: controlledSelected,
  onSelectionChange,
  getRowId = (row) => row.id,
  actions,
  bulkActions,
  onRowClick,
  className,
  loading = false,
  emptyMessage = "No data found",
  emptyIcon,
  compact = false,
}: DataTableProps<T>) {
  // Internal state (used when not server-side)
  const [internalPage, setInternalPage] = useState(1);
  const [internalSearch, setInternalSearch] = useState("");
  const [internalSort, setInternalSort] = useState<{
    key: string;
    dir: "asc" | "desc";
  } | null>(null);
  const [internalSelected, setInternalSelected] = useState<Set<string>>(
    new Set()
  );

  // Resolved state
  const page = controlledPage ?? internalPage;
  const selected = controlledSelected ?? internalSelected;
  const sortKey = controlledSortKey ?? internalSort?.key;
  const sortDir = controlledSortDir ?? internalSort?.dir ?? "asc";

  const setPage = useCallback(
    (p: number) => {
      onPageChange ? onPageChange(p) : setInternalPage(p);
    },
    [onPageChange]
  );

  const setSelected = useCallback(
    (ids: Set<string>) => {
      onSelectionChange ? onSelectionChange(ids) : setInternalSelected(ids);
    },
    [onSelectionChange]
  );

  // Client-side filtering
  const filteredData = useMemo(() => {
    if (serverSide || !internalSearch) return data;
    const q = internalSearch.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, internalSearch, columns, serverSide]);

  // Client-side sorting
  const sortedData = useMemo(() => {
    if (serverSide || !sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [filteredData, sortKey, sortDir, serverSide]);

  // Client-side pagination
  const totalItems = controlledTotal ?? sortedData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const pagedData = serverSide
    ? sortedData
    : sortedData.slice((page - 1) * pageSize, page * pageSize);

  // Handlers
  const handleSort = (key: string) => {
    const newDir = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    if (onSort) {
      onSort(key, newDir);
    } else {
      setInternalSort({ key, dir: newDir });
    }
  };

  const handleSearch = (value: string) => {
    setInternalSearch(value);
    setPage(1);
    onSearch?.(value);
  };

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === pagedData.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pagedData.map(getRowId)));
    }
  };

  // Format cell value
  const formatCell = (value: any, format?: Column<T>["format"]) => {
    if (value == null) return "-";
    switch (format) {
      case "money":
        return `$${Number(value).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      case "number":
        return Number(value).toLocaleString();
      case "percent":
        return `${Number(value).toFixed(2)}%`;
      case "date":
        return new Date(value).toLocaleDateString();
      case "datetime":
        return new Date(value).toLocaleString();
      default:
        return String(value);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      {(searchable || actions || (bulkActions && selected.size > 0)) && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            {searchable && (
              <Input
                placeholder={searchPlaceholder}
                value={internalSearch}
                onChange={(e) => handleSearch(e.target.value)}
                className="max-w-xs h-9"
              />
            )}
            {bulkActions && selected.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selected.size} selected
                </span>
                {bulkActions(selected)}
              </div>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {selectable && (
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={
                        pagedData.length > 0 &&
                        selected.size === pagedData.length
                      }
                      onChange={toggleAll}
                      className="rounded border-muted-foreground/50"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 text-left font-medium text-muted-foreground",
                      compact ? "py-2" : "py-3",
                      col.sortable && "cursor-pointer select-none hover:text-foreground",
                      col.headerClassName
                    )}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {col.header}
                      {col.sortable && sortKey === col.key && (
                        <SortIcon direction={sortDir} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {selectable && (
                      <td className="px-3 py-3">
                        <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pagedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="text-center py-12"
                  >
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      {emptyIcon || (
                        <svg className="w-10 h-10" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                          <path d="M14 2v6h6" />
                          <path d="M12 18v-6" />
                          <path d="m9 15 3-3 3 3" />
                        </svg>
                      )}
                      <p className="text-sm">{emptyMessage}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedData.map((row, rowIndex) => {
                  const rowId = getRowId(row);
                  const isSelected = selected.has(rowId);

                  return (
                    <tr
                      key={rowId}
                      className={cn(
                        "border-b transition-colors",
                        onRowClick && "cursor-pointer hover:bg-muted/50",
                        isSelected && "bg-primary/5"
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {selectable && (
                        <td
                          className="px-3 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(rowId)}
                            className="rounded border-muted-foreground/50"
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-4",
                            compact ? "py-2" : "py-3",
                            col.className
                          )}
                        >
                          {col.render
                            ? col.render(row, rowIndex)
                            : formatCell(row[col.key], col.format)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}-
            {Math.min(page * pageSize, totalItems)} of {totalItems.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(1)}
              disabled={page === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Prev
            </Button>
            {/* Page numbers */}
            {getPageNumbers(page, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">
                  ...
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(p as number)}
                  className="w-9"
                >
                  {p}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
            >
              Last
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Helpers
// ==========================================

function SortIcon({ direction }: { direction: "asc" | "desc" }) {
  return (
    <svg
      className="w-4 h-4"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      {direction === "asc" ? (
        <path d="m5 15 7-7 7 7" />
      ) : (
        <path d="m19 9-7 7-7-7" />
      )}
    </svg>
  );
}

function getPageNumbers(
  current: number,
  total: number
): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [1];

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) pages.push("...");
  pages.push(total);

  return pages;
}

// ==========================================
// StatusBadge — reusable status indicator
// ==========================================

const STATUS_STYLES: Record<string, string> = {
  // Generic
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-red-500/10 text-red-600 dark:text-red-400",
  completed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400",
  processing: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  cancelled: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  draft: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  paused: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  suspended: "bg-red-500/10 text-red-600 dark:text-red-400",
  banned: "bg-red-500/10 text-red-700 dark:text-red-400",
  onboarding: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  under_review: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  pending_verification: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  const style = STATUS_STYLES[key] || "bg-gray-500/10 text-gray-600";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize",
        style,
        className
      )}
    >
      {status.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}

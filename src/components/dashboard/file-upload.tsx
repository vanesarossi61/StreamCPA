"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ==========================================
// Types
// ==========================================

interface FileUploadProps {
  /** Upload handler — returns the public URL */
  onUpload: (file: File) => Promise<string>;
  /** Called when file is removed */
  onRemove?: (url: string) => Promise<void>;
  /** Accepted MIME types */
  accept?: string;
  /** Max file size in bytes (default 5MB) */
  maxSize?: number;
  /** Current value (URL) */
  value?: string | null;
  /** Label */
  label?: string;
  /** Helper text */
  description?: string;
  /** Preview shape */
  previewShape?: "square" | "circle" | "banner";
  className?: string;
  disabled?: boolean;
}

interface MultiFileUploadProps {
  onUpload: (file: File) => Promise<string>;
  onRemove?: (url: string) => Promise<void>;
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  values?: string[];
  label?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}

// ==========================================
// FileUpload — Single file upload with preview
// ==========================================

export function FileUpload({
  onUpload,
  onRemove,
  accept = "image/*",
  maxSize = 5 * 1024 * 1024, // 5MB
  value,
  label,
  description,
  previewShape = "square",
  className,
  disabled = false,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(value || null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      // Validate size
      if (file.size > maxSize) {
        setError(`File too large. Max size: ${formatBytes(maxSize)}`);
        return;
      }

      // Validate type
      if (accept && accept !== "*") {
        const accepted = accept.split(",").map((t) => t.trim());
        const isValid = accepted.some((t) => {
          if (t.endsWith("/*")) {
            return file.type.startsWith(t.replace("/*", "/"));
          }
          return file.type === t || file.name.endsWith(t);
        });
        if (!isValid) {
          setError("File type not allowed");
          return;
        }
      }

      // Show local preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => setPreviewUrl(e.target?.result as string);
        reader.readAsDataURL(file);
      }

      setUploading(true);
      try {
        const url = await onUpload(file);
        setPreviewUrl(url);
      } catch (err: any) {
        setError(err.message || "Upload failed");
        setPreviewUrl(value || null);
      } finally {
        setUploading(false);
      }
    },
    [accept, maxSize, onUpload, value]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled || uploading) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [disabled, uploading, handleFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleRemove = async () => {
    if (previewUrl && onRemove) {
      try {
        await onRemove(previewUrl);
      } catch {
        // Continue with removal even if server delete fails
      }
    }
    setPreviewUrl(null);
    setError(null);
  };

  const previewDimensions = {
    square: "w-32 h-32",
    circle: "w-24 h-24 rounded-full",
    banner: "w-full h-32",
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium">{label}</label>
      )}

      {previewUrl ? (
        /* Preview mode */
        <div className="relative inline-block">
          <div
            className={cn(
              "overflow-hidden rounded-lg border bg-muted",
              previewDimensions[previewShape]
            )}
          >
            <img
              src={previewUrl}
              alt="Upload preview"
              className="w-full h-full object-cover"
            />
          </div>
          {!disabled && (
            <div className="absolute -top-2 -right-2 flex gap-1">
              <button
                onClick={() => inputRef.current?.click()}
                className="w-6 h-6 rounded-full bg-background border shadow flex items-center justify-center hover:bg-muted"
                title="Replace"
              >
                <svg className="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
              </button>
              <button
                onClick={handleRemove}
                className="w-6 h-6 rounded-full bg-background border shadow flex items-center justify-center hover:bg-red-50 text-red-500"
                title="Remove"
              >
                <svg className="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" x2="6" y1="6" y2="18" />
                  <line x1="6" x2="18" y1="6" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Dropzone */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
            (disabled || uploading) && "cursor-not-allowed opacity-50"
          )}
        >
          {uploading ? (
            <>
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </>
          ) : (
            <>
              <svg
                className="w-8 h-8 text-muted-foreground/50"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
              <div className="text-center">
                <p className="text-sm">
                  <span className="text-primary font-medium">Click to upload</span>{" "}
                  or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Max {formatBytes(maxSize)}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hidden input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={disabled || uploading}
      />

      {/* Description */}
      {description && !error && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}

// ==========================================
// MultiFileUpload — Multiple files with grid preview
// ==========================================

export function MultiFileUpload({
  onUpload,
  onRemove,
  accept = "image/*",
  maxSize = 5 * 1024 * 1024,
  maxFiles = 5,
  values = [],
  label,
  description,
  className,
  disabled = false,
}: MultiFileUploadProps) {
  const [urls, setUrls] = useState<string[]>(values);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    const remaining = maxFiles - urls.length;
    if (remaining <= 0) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const toUpload = Array.from(files).slice(0, remaining);
    setError(null);
    setUploading(true);

    try {
      const results = await Promise.allSettled(
        toUpload.map(async (file) => {
          if (file.size > maxSize) throw new Error(`${file.name} too large`);
          return onUpload(file);
        })
      );

      const newUrls = results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
        .map((r) => r.value);

      const failures = results.filter((r) => r.status === "rejected").length;
      if (failures > 0) {
        setError(`${failures} file(s) failed to upload`);
      }

      setUrls((prev) => [...prev, ...newUrls]);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = async (url: string) => {
    if (onRemove) {
      try {
        await onRemove(url);
      } catch {
        // continue
      }
    }
    setUrls((prev) => prev.filter((u) => u !== url));
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="text-sm font-medium">{label}</label>}

      {/* Preview grid */}
      {urls.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {urls.map((url) => (
            <div key={url} className="relative aspect-square rounded-lg overflow-hidden border bg-muted group">
              <img src={url} alt="" className="w-full h-full object-cover" />
              {!disabled && (
                <button
                  onClick={() => handleRemoveFile(url)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" x2="6" y1="6" y2="18" />
                    <line x1="6" x2="18" y1="6" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add more */}
      {urls.length < maxFiles && !disabled && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : `Add file${maxFiles > 1 ? "s" : ""}`}
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={maxFiles > 1}
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
        className="hidden"
      />

      {description && !error && (
        <p className="text-xs text-muted-foreground">
          {description} ({urls.length}/{maxFiles})
        </p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ==========================================
// Helpers
// ==========================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

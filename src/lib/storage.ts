/**
 * Storage — Supabase Storage wrapper for StreamCPA
 *
 * Manages file uploads for:
 *   - Brand logos and campaign banners
 *   - Campaign materials (images, videos)
 *   - Fraud evidence screenshots
 *   - Streamer avatars (backup from Twitch)
 *
 * Uses Supabase Storage with presigned URLs for direct uploads.
 * Files are organized into buckets by type.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// ==========================================
// CLIENT
// ==========================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!, // Service key for server-side operations
);

// ==========================================
// TYPES
// ==========================================

export type StorageBucket =
  | "logos"          // Brand logos
  | "banners"        // Campaign banners
  | "materials"      // Campaign materials (creatives)
  | "avatars"        // User/streamer avatars
  | "fraud-evidence" // Fraud screenshots
  | "exports";       // CSV/report exports

export interface UploadResult {
  path: string;        // Full storage path
  publicUrl: string;   // Public URL (if bucket is public)
  bucket: StorageBucket;
  size: number;
}

export interface PresignedUpload {
  uploadUrl: string;   // URL for direct PUT upload
  path: string;        // Where the file will live
  publicUrl: string;   // Public URL after upload
  expiresAt: number;   // Unix timestamp
}

// ==========================================
// CONFIG
// ==========================================

const BUCKET_CONFIG: Record<StorageBucket, {
  maxSizeMB: number;
  allowedMimeTypes: string[];
  isPublic: boolean;
}> = {
  logos: {
    maxSizeMB: 2,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    isPublic: true,
  },
  banners: {
    maxSizeMB: 5,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    isPublic: true,
  },
  materials: {
    maxSizeMB: 50,
    allowedMimeTypes: [
      "image/png", "image/jpeg", "image/gif", "image/webp",
      "video/mp4", "video/webm",
      "application/pdf",
    ],
    isPublic: false,
  },
  avatars: {
    maxSizeMB: 2,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    isPublic: true,
  },
  "fraud-evidence": {
    maxSizeMB: 10,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
    isPublic: false,
  },
  exports: {
    maxSizeMB: 100,
    allowedMimeTypes: ["text/csv", "application/json", "application/pdf"],
    isPublic: false,
  },
};

// ==========================================
// HELPERS
// ==========================================

/**
 * Generate a unique file path within a bucket.
 * Format: {userId}/{uuid}.{extension}
 */
function generatePath(userId: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "bin";
  return `${userId}/${randomUUID()}.${ext}`;
}

/**
 * Validate file against bucket constraints
 */
function validateFile(
  bucket: StorageBucket,
  filename: string,
  sizeBytes: number,
  mimeType: string,
): void {
  const config = BUCKET_CONFIG[bucket];

  if (sizeBytes > config.maxSizeMB * 1024 * 1024) {
    throw new Error(
      `File too large. Max size for ${bucket}: ${config.maxSizeMB}MB`,
    );
  }

  if (!config.allowedMimeTypes.includes(mimeType)) {
    throw new Error(
      `File type "${mimeType}" not allowed for ${bucket}. Allowed: ${config.allowedMimeTypes.join(", ")}`,
    );
  }
}

/**
 * Get public URL for a file in a bucket
 */
function getPublicUrl(bucket: StorageBucket, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// ==========================================
// PUBLIC FUNCTIONS
// ==========================================

/**
 * Upload a file directly from a Buffer or Blob.
 * Use for server-side uploads (e.g., saving fraud screenshots).
 */
export async function uploadFile(
  bucket: StorageBucket,
  userId: string,
  file: Buffer | Blob,
  filename: string,
  mimeType: string,
): Promise<UploadResult> {
  const sizeBytes = file instanceof Buffer ? file.length : file.size;
  validateFile(bucket, filename, sizeBytes, mimeType);

  const path = generatePath(userId, filename);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return {
    path,
    publicUrl: getPublicUrl(bucket, path),
    bucket,
    size: sizeBytes,
  };
}

/**
 * Generate a presigned URL for direct client-side upload.
 * Use for large files (campaign materials, videos) to avoid
 * proxying through the API server.
 *
 * Client uploads directly to Supabase Storage via PUT.
 */
export async function createPresignedUpload(
  bucket: StorageBucket,
  userId: string,
  filename: string,
  sizeBytes: number,
  mimeType: string,
): Promise<PresignedUpload> {
  validateFile(bucket, filename, sizeBytes, mimeType);

  const path = generatePath(userId, filename);
  const expiresIn = 3600; // 1 hour

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Failed to create upload URL: ${error?.message}`);
  }

  return {
    uploadUrl: data.signedUrl,
    path,
    publicUrl: getPublicUrl(bucket, path),
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

/**
 * Delete a file from storage
 */
export async function deleteFile(
  bucket: StorageBucket,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

/**
 * Delete all files for a user in a bucket
 */
export async function deleteUserFiles(
  bucket: StorageBucket,
  userId: string,
): Promise<number> {
  const { data: files, error: listError } = await supabase.storage
    .from(bucket)
    .list(userId);

  if (listError || !files?.length) return 0;

  const paths = files.map((f) => `${userId}/${f.name}`);
  const { error } = await supabase.storage.from(bucket).remove(paths);

  if (error) {
    throw new Error(`Bulk delete failed: ${error.message}`);
  }

  return paths.length;
}

/**
 * Get a temporary signed URL for private files
 * (e.g., fraud evidence, exports)
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresIn: number = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message}`);
  }

  return data.signedUrl;
}

/**
 * List files in a user's folder within a bucket
 */
export async function listUserFiles(
  bucket: StorageBucket,
  userId: string,
): Promise<Array<{ name: string; size: number; createdAt: string }>> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(userId, { sortBy: { column: "created_at", order: "desc" } });

  if (error) {
    throw new Error(`List failed: ${error.message}`);
  }

  return (data || []).map((f) => ({
    name: f.name,
    size: f.metadata?.size || 0,
    createdAt: f.created_at,
  }));
}

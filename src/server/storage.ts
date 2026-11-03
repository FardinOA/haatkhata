import "server-only";
/**
 * File storage for logos and product photos (SRS §5.3: object storage + CDN).
 * STORAGE_DRIVER=local writes to ./uploads (served by /api/files);
 * STORAGE_DRIVER=s3 uploads to any S3-compatible bucket (AWS, R2, MinIO, Wasabi).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "image/gif": "gif" };
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

function parseDataUrl(dataUrl: string) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!m || !EXT[m[1]]) throw new Error("Unsupported image");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_UPLOAD_BYTES) throw new Error("Image is larger than 4 MB");
  return { mime: m[1], buf };
}

/** Stores an image and returns its public URL. Content-addressed, so re-uploads are free. */
export async function storeDataUrl(businessId: string, dataUrl: string): Promise<string> {
  const { mime, buf } = parseDataUrl(dataUrl);
  const key = `${businessId}/${createHash("sha256").update(buf).digest("hex").slice(0, 32)}.${EXT[mime]}`;
  if (process.env.STORAGE_DRIVER === "s3") {
    const s3 = new AwsClient({ accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY!, service: "s3", region: process.env.S3_REGION ?? "auto" });
    const url = `${process.env.S3_ENDPOINT!.replace(/\/$/, "")}/${process.env.S3_BUCKET}/${key}`;
    const res = await s3.fetch(url, { method: "PUT", body: buf, headers: { "content-type": mime, "cache-control": "public, max-age=31536000, immutable" } });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    return `${(process.env.S3_PUBLIC_URL ?? url.replace(key, "")).replace(/\/$/, "")}/${key}`;
  }
  const file = path.join(UPLOAD_ROOT, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buf);
  return `/api/files/${key}`;
}

export async function readLocalFile(key: string) {
  const safe = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  const file = path.join(UPLOAD_ROOT, safe);
  if (!file.startsWith(UPLOAD_ROOT)) throw new Error("Bad path");
  const ext = path.extname(file).slice(1);
  const mime = Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
  return { body: await readFile(file), mime };
}

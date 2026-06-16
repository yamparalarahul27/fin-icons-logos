/**
 * Pluggable logo-image storage.
 *
 * Production uses Cloudflare R2 (S3-compatible, zero egress) — chosen in
 * PLAN.md §6 because this is a read-heavy image CDN. When R2 env vars are not
 * configured we fall back to the local public/ tree so the app runs with no
 * cloud credentials (dev + this sandbox).
 *
 * Object paths are backend-agnostic: `<chain>/<address>/<size>.png`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { S3Client } from "@aws-sdk/client-s3";
import { OVERRIDES_DIR, OVERRIDES_PUBLIC_BASE } from "./paths";

export interface LogoStorage {
  readonly kind: "r2" | "local";
  put(objectPath: string, bytes: Buffer, contentType: string): Promise<void>;
  /** Public URL the CDN/site serves this object from. */
  urlFor(objectPath: string): string;
}

function localStorage(): LogoStorage {
  return {
    kind: "local",
    async put(objectPath, bytes) {
      const file = path.join(OVERRIDES_DIR, objectPath);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
    },
    urlFor(objectPath) {
      return `${OVERRIDES_PUBLIC_BASE}/${objectPath}`;
    },
  };
}

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Public base URL of the bucket (r2.dev domain or a CDN custom domain). */
  publicBase: string;
  /** Key prefix within the bucket. */
  prefix: string;
}

function r2Config(): R2Config | null {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_PUBLIC_BASE_URL,
    R2_KEY_PREFIX,
  } = process.env;
  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET ||
    !R2_PUBLIC_BASE_URL
  ) {
    return null;
  }
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    publicBase: R2_PUBLIC_BASE_URL.replace(/\/+$/, ""),
    prefix: (R2_KEY_PREFIX ?? "overrides").replace(/^\/+|\/+$/g, ""),
  };
}

function r2Storage(cfg: R2Config): LogoStorage {
  let clientPromise: Promise<S3Client> | null = null;
  function client(): Promise<S3Client> {
    if (!clientPromise) {
      clientPromise = import("@aws-sdk/client-s3").then(
        ({ S3Client }) =>
          new S3Client({
            region: "auto",
            endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
            credentials: {
              accessKeyId: cfg.accessKeyId,
              secretAccessKey: cfg.secretAccessKey,
            },
          }),
      );
    }
    return clientPromise;
  }

  const key = (objectPath: string) => `${cfg.prefix}/${objectPath}`;

  return {
    kind: "r2",
    async put(objectPath, bytes, contentType) {
      const [{ PutObjectCommand }, s3] = await Promise.all([
        import("@aws-sdk/client-s3"),
        client(),
      ]);
      await s3.send(
        new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: key(objectPath),
          Body: bytes,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    },
    urlFor(objectPath) {
      return `${cfg.publicBase}/${key(objectPath)}`;
    },
  };
}

export function getStorage(): LogoStorage {
  const cfg = r2Config();
  return cfg ? r2Storage(cfg) : localStorage();
}

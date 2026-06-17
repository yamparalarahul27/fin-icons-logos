/**
 * Ingestion-side logo storage (PLAN.md §5).
 *
 * Auto-fetched logos are uploaded to Cloudflare R2 under the `logos/` prefix and
 * served from the CDN, distinct from admin-uploaded `overrides/` (apps/web). When
 * R2 env vars are absent we fall back to writing the local public/ tree so the
 * spike runs with no credentials.
 *
 * Object paths are backend-agnostic: `<chain>/<address>/<size>.png`.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { S3Client } from "@aws-sdk/client-s3";
import { type LogoSet } from "@fin/shared";
import { renderLogo, type RawLogo } from "./normalize.js";

/** A place to persist a normalized logo set and report back the URLs it serves from. */
export interface LogoSink {
  readonly kind: "r2" | "local";
  put(chain: string, address: string, raw: RawLogo): Promise<LogoSet>;
}

/**
 * Load R2 creds from apps/web/.env.local into process.env if not already set, so
 * the spike picks up the same credentials the web app uses without duplicating
 * them. In CI the vars are already in the environment and this is a no-op.
 */
export function loadEnv(repoRoot: string): void {
  if (process.env.R2_ACCOUNT_ID) return;
  const envPath = path.join(repoRoot, "apps/web/.env.local");
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      /* ignore — fall back to local sink */
    }
  }
}

function urlSet(base: string, sourceW: number, sourceH: number): LogoSet {
  return {
    png256: `${base}/256.png`,
    png128: `${base}/128.png`,
    png64: `${base}/64.png`,
    png32: `${base}/32.png`,
    svg: null,
    sourceWidth: sourceW,
    sourceHeight: sourceH,
  };
}

function localSink(outDir: string, publicBase: string): LogoSink {
  return {
    kind: "local",
    async put(chain, address, raw) {
      const dir = path.join(outDir, chain, address);
      await mkdir(dir, { recursive: true });
      const rendered = await renderLogo(raw);
      await Promise.all(
        rendered.map(({ size, png }) => writeFile(path.join(dir, `${size}.png`), png)),
      );
      return urlSet(`${publicBase}/${chain}/${address}`, raw.width, raw.height);
    },
  };
}

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBase: string;
  prefix: string;
}

function r2Config(): R2Config | null {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_PUBLIC_BASE_URL,
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
    // Auto logos go under `logos/`, leaving the `overrides/` prefix for admin uploads.
    prefix: (process.env.R2_LOGOS_PREFIX ?? "logos").replace(/^\/+|\/+$/g, ""),
  };
}

function r2Sink(cfg: R2Config): LogoSink {
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

  return {
    kind: "r2",
    async put(chain, address, raw) {
      const [{ PutObjectCommand }, s3, rendered] = await Promise.all([
        import("@aws-sdk/client-s3"),
        client(),
        renderLogo(raw),
      ]);
      await Promise.all(
        rendered.map(({ size, png }) =>
          s3.send(
            new PutObjectCommand({
              Bucket: cfg.bucket,
              Key: `${cfg.prefix}/${chain}/${address}/${size}.png`,
              Body: png,
              ContentType: "image/png",
              CacheControl: "public, max-age=31536000, immutable",
            }),
          ),
        ),
      );
      return urlSet(`${cfg.publicBase}/${cfg.prefix}/${chain}/${address}`, raw.width, raw.height);
    },
  };
}

/** R2 if creds are present (after loadEnv), else the local public/ tree. */
export function getLogoSink(opts: { outDir: string; publicBase: string }): LogoSink {
  const cfg = r2Config();
  return cfg ? r2Sink(cfg) : localSink(opts.outDir, opts.publicBase);
}

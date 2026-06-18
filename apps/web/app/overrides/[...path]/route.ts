import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { OVERRIDES_DIR } from "@/lib/paths";

// Override images are written at runtime, so `next start` won't serve them from
// public/ (that's snapshotted at build). Stream them from disk instead. This is
// a Phase-1 stand-in for the R2/CDN delivery planned in Phase 2.
export const runtime = "nodejs";
// NOTE: do not set `dynamic = "force-dynamic"` — it makes Next stamp its own
// `Cache-Control: max-age=0`, clobbering the immutable header below. The route is
// already dynamic (it awaits params + reads request headers).

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

// Curated override images are content-addressed by <chain>/<address>/<size>.png,
// so they're safe to cache hard. This slashes origin hits (SECURITY-PLAN.md §2);
// in prod these are served from R2/CDN anyway and this route is the dev fallback.
const CACHE_CONTROL = "public, max-age=31536000, immutable";

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;

  // Resolve and confine to OVERRIDES_DIR to block path traversal.
  const target = path.resolve(OVERRIDES_DIR, ...segments);
  if (target !== OVERRIDES_DIR && !target.startsWith(OVERRIDES_DIR + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const info = await stat(target);
    if (!info.isFile()) return new Response("Not found", { status: 404 });

    const type = CONTENT_TYPES[path.extname(target).toLowerCase()] ?? "application/octet-stream";
    const lastModified = info.mtime.toUTCString();
    // Weak validator from size + mtime — cheap and stable per file revision.
    const etag = `W/"${info.size}-${Math.floor(info.mtimeMs)}"`;

    // Honour conditional requests so revalidation is a cheap 304, no body.
    const ifNoneMatch = req.headers.get("if-none-match");
    const ifModifiedSince = req.headers.get("if-modified-since");
    const notModified =
      ifNoneMatch === etag ||
      (!!ifModifiedSince && new Date(ifModifiedSince).getTime() >= info.mtime.getTime());
    if (notModified) {
      return new Response(null, {
        status: 304,
        headers: { "Cache-Control": CACHE_CONTROL, ETag: etag, "Last-Modified": lastModified },
      });
    }

    const stream = Readable.toWeb(createReadStream(target)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        "Cache-Control": CACHE_CONTROL,
        ETag: etag,
        "Last-Modified": lastModified,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

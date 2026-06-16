import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { OVERRIDES_DIR } from "@/lib/paths";

// Override images are written at runtime, so `next start` won't serve them from
// public/ (that's snapshotted at build). Stream them from disk instead. This is
// a Phase-1 stand-in for the R2/CDN delivery planned in Phase 2.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
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
    const stream = Readable.toWeb(createReadStream(target)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

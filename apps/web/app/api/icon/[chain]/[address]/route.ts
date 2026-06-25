import { NextResponse } from "next/server";
import { isVariantShape, makeBadged, makeVariant, resizeVariant } from "@/lib/variant";

/**
 * Treated icons on demand:
 *   GET /api/icon/{chain}/{address}?shape=rounded&size=128
 *   GET /api/icon/{chain}/{address}?badge={chain}:{address}        (corner badge)
 *   GET /api/icon/{chain}/{address}?shape=rounded&badge=network:base
 *
 * `shape` (rounded|semi-rounded) and `badge` are both optional but at least one
 * is required. Hybrid: an admin shape override wins over auto-generation. The
 * badge is any other asset, composited small in the corner. CORS-open,
 * rate-limited in middleware.
 */
export const runtime = "nodejs";

const CDN = (process.env.R2_PUBLIC_BASE_URL ?? "https://cdn.defitriangle.xyz").replace(/\/+$/, "");
const PREFIX = (process.env.R2_KEY_PREFIX ?? "overrides").replace(/^\/+|\/+$/g, "");

async function fetchBytes(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** Base logo bytes for an asset: curated override default, else auto-ingested. */
async function baseLogo(chain: string, addr: string): Promise<Buffer | null> {
  return (
    (await fetchBytes(`${CDN}/${PREFIX}/${chain}/${addr}/256.png`)) ??
    (await fetchBytes(`${CDN}/logos/${chain}/${addr}/256.png`))
  );
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ chain: string; address: string }> },
) {
  const { chain, address } = await ctx.params;
  const addr = decodeURIComponent(address);
  const sp = new URL(req.url).searchParams;
  const shape = sp.get("shape");
  const badge = sp.get("badge"); // "{chain}:{address}"
  const sizeRaw = Number(sp.get("size") ?? 128);

  if (shape && !isVariantShape(shape)) {
    return NextResponse.json({ error: "shape must be 'rounded' or 'semi-rounded'." }, { status: 400 });
  }
  if (!shape && !badge) {
    return NextResponse.json({ error: "Provide a 'shape' and/or 'badge'." }, { status: 400 });
  }
  const size = Number.isFinite(sizeRaw) ? Math.min(512, Math.max(16, Math.floor(sizeRaw))) : 128;

  // 1) Build the primary icon (shaped, or just the base resized).
  let out: Buffer;
  if (shape && isVariantShape(shape)) {
    const adminSrc = await fetchBytes(`${CDN}/${PREFIX}/${chain}/${addr}/variant-${shape}.png`);
    if (adminSrc) {
      out = await resizeVariant(adminSrc, size);
    } else {
      const base = await baseLogo(chain, addr);
      if (!base) return NextResponse.json({ error: "Logo not found." }, { status: 404 });
      out = await makeVariant(base, size, shape);
    }
  } else {
    const base = await baseLogo(chain, addr);
    if (!base) return NextResponse.json({ error: "Logo not found." }, { status: 404 });
    out = await resizeVariant(base, size);
  }

  // 2) Optional corner badge from another asset ("{chain}:{address}").
  if (badge) {
    const sep = badge.indexOf(":");
    const bChain = sep === -1 ? badge : badge.slice(0, sep);
    const bAddr = sep === -1 ? "native" : badge.slice(sep + 1);
    const badgeBase = await baseLogo(bChain, decodeURIComponent(bAddr));
    if (badgeBase) out = await makeBadged(out, badgeBase, size);
  }

  return new NextResponse(new Uint8Array(out), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

import { NextResponse } from "next/server";
import { isVariantShape, makeVariant, resizeVariant } from "@/lib/variant";

/**
 * Shape variants on demand: GET /api/icon/{chain}/{address}?shape=rounded&size=128
 *
 * Hybrid: if an admin uploaded an override for this shape it's used as-is; else
 * the variant is auto-generated from the base logo (dominant-color badge clipped
 * to the shape). CORS-open so any app can hotlink it. Rate-limited in middleware.
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

export async function GET(
  req: Request,
  ctx: { params: Promise<{ chain: string; address: string }> },
) {
  const { chain, address } = await ctx.params;
  const addr = decodeURIComponent(address);
  const sp = new URL(req.url).searchParams;
  const shape = sp.get("shape") ?? "";
  const sizeRaw = Number(sp.get("size") ?? 128);

  if (!isVariantShape(shape)) {
    return NextResponse.json(
      { error: "shape must be 'rounded' or 'semi-rounded'." },
      { status: 400 },
    );
  }
  const size = Number.isFinite(sizeRaw) ? Math.min(512, Math.max(16, Math.floor(sizeRaw))) : 128;

  // Hybrid: admin-uploaded override for this shape wins over auto-generation.
  const adminSrc = await fetchBytes(`${CDN}/${PREFIX}/${chain}/${addr}/variant-${shape}.png`);

  let out: Buffer;
  if (adminSrc) {
    out = await resizeVariant(adminSrc, size);
  } else {
    // Base logo: the curated override default, else the auto-ingested logo.
    const base =
      (await fetchBytes(`${CDN}/${PREFIX}/${chain}/${addr}/256.png`)) ??
      (await fetchBytes(`${CDN}/logos/${chain}/${addr}/256.png`));
    if (!base) {
      return NextResponse.json({ error: "Logo not found." }, { status: 404 });
    }
    out = await makeVariant(base, size, shape);
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

import { NextResponse } from "next/server";

/**
 * Same-origin image proxy for "copy logo to clipboard".
 *
 * Browsers can't read a cross-origin image as a blob without CORS, and the CDN
 * serves immutable, edge-cached copies that predate any CORS rule. Rather than
 * fight that, the client fetches the logo through this same-origin route, which
 * pulls the bytes from the CDN server-side. Only hit on an explicit copy click,
 * and the host is fixed (no SSRF) — it only ever proxies our own logo paths.
 */
export const runtime = "nodejs";

const CDN_BASE = (process.env.R2_PUBLIC_BASE_URL ?? "https://cdn.defitriangle.xyz").replace(
  /\/+$/,
  "",
);
const SIZES = new Set([32, 64, 128, 256]);

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const chain = sp.get("chain") ?? "";
  const address = sp.get("address") ?? "";
  const size = Number(sp.get("size") ?? 256);

  if (!chain || !address || !SIZES.has(size)) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const url = `${CDN_BASE}/logos/${encodeURIComponent(chain)}/${encodeURIComponent(address)}/${size}.png`;
  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok) {
    return NextResponse.json({ error: "Logo not found." }, { status: upstream.status });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

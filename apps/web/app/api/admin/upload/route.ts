import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import DOMPurify from "isomorphic-dompurify";
import sharp from "sharp";
import { renderLogo, type RawLogo } from "@fin/ingestion/normalize";
import { CHAINS, normalizeAddress, type LogoSet } from "@fin/shared";
import { getStorage } from "@/lib/storage";
import { getOverrideRepo } from "@/lib/overrides-repo";
import { requireAdmin } from "@/lib/admin-guard";
import { isVariantShape } from "@/lib/variant";

// sharp + DOMPurify are server-only — force the Node runtime, not the edge.
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_SOURCE_PX = 128; // raster floor; vectors are exempt (scalable)
const SVG_DENSITY = 384; // rasterization DPI for crisp PNGs from SVG

/** Strip scripts, event handlers, foreignObject, external refs from an SVG. */
function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}

/** Short content hash → `?v=` so a re-upload busts the immutable CDN cache. */
const versionOf = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex").slice(0, 10);

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const chain = String(form.get("chain") ?? "");
  const rawAddress = String(form.get("address") ?? "");
  const file = form.get("file");

  const info = CHAINS[chain];
  if (!info) {
    return NextResponse.json({ error: `Unknown chain "${chain}".` }, { status: 400 });
  }
  if (!rawAddress) {
    return NextResponse.json({ error: "Missing address." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 5 MB." }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const address = normalizeAddress(rawAddress, info.evm);
  const id = `${chain}:${address}`;
  const storage = getStorage();
  const base = `${chain}/${address}`;

  // SVG by declared type or content sniff.
  const isSvg =
    file.type === "image/svg+xml" || /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(bytes.toString("utf8", 0, 512));

  // Shape-variant upload: store the admin's design as the source for that shape
  // (the /api/icon endpoint serves + resizes it, overriding auto-generation).
  const variant = String(form.get("variant") ?? "default");
  if (variant !== "default") {
    if (!isVariantShape(variant)) {
      return NextResponse.json({ error: `Unknown variant "${variant}".` }, { status: 400 });
    }
    let src: Buffer;
    try {
      const input = isSvg
        ? await sharp(Buffer.from(sanitizeSvg(bytes.toString("utf8")), "utf8"), {
            density: SVG_DENSITY,
          })
        : sharp(bytes);
      src = await input
        .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    } catch {
      return NextResponse.json({ error: "Could not process variant image." }, { status: 422 });
    }
    const key = `${base}/variant-${variant}.png`;
    await storage.put(key, src, "image/png");
    return NextResponse.json({
      id,
      variant,
      url: `${storage.urlFor(key)}?v=${versionOf(src)}`,
      storage: storage.kind,
    });
  }

  let logo: LogoSet;

  if (isSvg) {
    const clean = sanitizeSvg(bytes.toString("utf8"));
    if (!/<svg[\s>]/i.test(clean)) {
      return NextResponse.json({ error: "Not a valid SVG after sanitization." }, { status: 422 });
    }
    const svgBuf = Buffer.from(clean, "utf8");

    // Native pixel size (from width/height or viewBox), best-effort.
    let meta: sharp.Metadata | null = null;
    try {
      meta = await sharp(svgBuf).metadata();
    } catch {
      return NextResponse.json({ error: "Could not parse SVG." }, { status: 422 });
    }

    const raw: RawLogo = { bytes: svgBuf, width: meta.width ?? 0, height: meta.height ?? 0 };
    const rendered = await renderLogo(raw, { density: SVG_DENSITY });
    const version = versionOf(svgBuf);

    await Promise.all([
      storage.put(`${base}/logo.svg`, svgBuf, "image/svg+xml"),
      ...rendered.map(({ size, png }) => storage.put(`${base}/${size}.png`, png, "image/png")),
    ]);

    const v = `?v=${version}`;
    logo = {
      png256: storage.urlFor(`${base}/256.png`) + v,
      png128: storage.urlFor(`${base}/128.png`) + v,
      png64: storage.urlFor(`${base}/64.png`) + v,
      png32: storage.urlFor(`${base}/32.png`) + v,
      svg: storage.urlFor(`${base}/logo.svg`) + v,
      sourceWidth: meta.width ?? 0,
      sourceHeight: meta.height ?? 0,
    };
  } else {
    let meta: sharp.Metadata;
    try {
      meta = await sharp(bytes).metadata();
    } catch {
      return NextResponse.json({ error: "Could not decode image." }, { status: 422 });
    }
    if (!meta.width || !meta.height) {
      return NextResponse.json({ error: "Image has no dimensions." }, { status: 422 });
    }
    if (Math.max(meta.width, meta.height) < MIN_SOURCE_PX) {
      return NextResponse.json(
        { error: `Logo must be at least ${MIN_SOURCE_PX}px on its longest edge.` },
        { status: 422 },
      );
    }

    const raw: RawLogo = { bytes, width: meta.width, height: meta.height };
    const rendered = await renderLogo(raw);
    const version = versionOf(bytes);
    await Promise.all(
      rendered.map(({ size, png }) => storage.put(`${base}/${size}.png`, png, "image/png")),
    );

    const v = `?v=${version}`;
    logo = {
      png256: storage.urlFor(`${base}/256.png`) + v,
      png128: storage.urlFor(`${base}/128.png`) + v,
      png64: storage.urlFor(`${base}/64.png`) + v,
      png32: storage.urlFor(`${base}/32.png`) + v,
      svg: null,
      sourceWidth: meta.width,
      sourceHeight: meta.height,
    };
  }

  await getOverrideRepo().set(id, logo);
  return NextResponse.json({ id, quality: "curated", logo, storage: storage.kind });
}

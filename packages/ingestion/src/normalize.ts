import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { LOGO_SIZES, type LogoSet } from "@fin/shared";

/** A logo source image fetched as raw bytes, before normalization. */
export interface RawLogo {
  bytes: Buffer;
  /** Native dimensions, used to decide quality. */
  width: number;
  height: number;
}

/** Fetch + decode a source logo. Returns null on network/decode failure. */
export async function fetchLogo(url: string): Promise<RawLogo | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(bytes).metadata();
    if (!meta.width || !meta.height) return null;
    return { bytes, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

/**
 * Re-encode a source logo to the canonical square PNG sizes, transparent
 * background, `contain` fit so non-square art is letterboxed rather than
 * cropped. Writes to <outDir>/<chain>/<address>/<size>.png and returns the
 * public URL set (paths relative to the web public root).
 */
export async function normalizeLogo(
  raw: RawLogo,
  opts: { outDir: string; publicBase: string; chain: string; address: string },
): Promise<LogoSet> {
  const dir = path.join(opts.outDir, opts.chain, opts.address);
  await mkdir(dir, { recursive: true });

  for (const size of LOGO_SIZES) {
    const png = await sharp(raw.bytes)
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    await writeFile(path.join(dir, `${size}.png`), png);
  }

  const base = `${opts.publicBase}/${opts.chain}/${opts.address}`;
  return {
    png256: `${base}/256.png`,
    png128: `${base}/128.png`,
    png64: `${base}/64.png`,
    png32: `${base}/32.png`,
    svg: null,
    sourceWidth: raw.width,
    sourceHeight: raw.height,
  };
}

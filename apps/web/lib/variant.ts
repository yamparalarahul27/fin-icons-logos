import sharp from "sharp";

/** Shape variants apps can request. `rounded` = circle, `semi-rounded` = squircle. */
export type VariantShape = "rounded" | "semi-rounded";
export const VARIANT_SHAPES: readonly VariantShape[] = ["rounded", "semi-rounded"];

export function isVariantShape(s: string): s is VariantShape {
  return (VARIANT_SHAPES as readonly string[]).includes(s);
}

function maskSvg(size: number, shape: VariantShape): Buffer {
  const r = shape === "rounded" ? size / 2 : Math.round(size * 0.22);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
  );
}

/**
 * Auto-generate a badge variant from a base logo: a dominant-color tile with the
 * trimmed logo centered, clipped to the shape. Looks branded for full-bleed marks
 * (e.g. BTC) and clean for transparent marks (e.g. USDC); washed-out backgrounds
 * fall back to a neutral tile.
 */
export async function makeVariant(base: Buffer, size: number, shape: VariantShape): Promise<Buffer> {
  const stats = await sharp(base).stats();
  let { r, g, b } = stats.dominant;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance > 0.82) {
    r = 24;
    g = 24;
    b = 27;
  }

  const trimmed = await sharp(base)
    .trim()
    .toBuffer()
    .catch(() => base);
  const inner = Math.round(size * 0.7);
  const logo = await sharp(trimmed)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const bg = await sharp({
    create: { width: size, height: size, channels: 4, background: { r, g, b, alpha: 1 } },
  })
    .png()
    .toBuffer();
  const composed = await sharp(bg).composite([{ input: logo, gravity: "center" }]).png().toBuffer();
  return sharp(composed)
    .composite([{ input: maskSvg(size, shape), blend: "dest-in" }])
    .png()
    .toBuffer();
}

/** Resize an admin-provided variant source (already shaped) to the requested size. */
export function resizeVariant(src: Buffer, size: number): Promise<Buffer> {
  return sharp(src)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

function circle(d: number): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}">` +
      `<circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="#fff"/></svg>`,
  );
}

/**
 * Composite a small circular badge (e.g. a network or issuer logo) into the
 * bottom-right of a primary icon, with a transparent gap "cutout" so it reads as
 * separate on any background. Used for "token + badge" composite variants.
 */
export async function makeBadged(primary: Buffer, badge: Buffer, size: number): Promise<Buffer> {
  const badgeD = Math.round(size * 0.44);
  const gap = Math.max(2, Math.round(size * 0.045));
  const holeD = badgeD + gap * 2;
  const margin = Math.round(size * 0.02);
  const holeX = size - holeD - margin;
  const holeY = size - holeD - margin;
  const badgeX = holeX + gap;
  const badgeY = holeY + gap;

  const base = await sharp(primary)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Punch a transparent circular gap where the badge will sit.
  const hole = await sharp({
    create: { width: holeD, height: holeD, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: circle(holeD) }])
    .png()
    .toBuffer();
  const holed = await sharp(base)
    .composite([{ input: hole, left: holeX, top: holeY, blend: "dest-out" }])
    .png()
    .toBuffer();

  // Circular badge.
  const badgeImg = await sharp(badge)
    .resize(badgeD, badgeD, { fit: "cover" })
    .composite([{ input: circle(badgeD), blend: "dest-in" }])
    .png()
    .toBuffer();

  return sharp(holed)
    .composite([{ input: badgeImg, left: badgeX, top: badgeY }])
    .png()
    .toBuffer();
}

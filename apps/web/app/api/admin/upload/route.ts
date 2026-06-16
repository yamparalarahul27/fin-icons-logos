import { NextResponse } from "next/server";
import sharp from "sharp";
import { normalizeLogo, type RawLogo } from "@fin/ingestion/normalize";
import { CHAINS, normalizeAddress } from "@fin/shared";
import { OVERRIDES_DIR, OVERRIDES_PUBLIC_BASE, saveOverride } from "@/lib/manifest";

// sharp is a native module — force the Node runtime, not the edge runtime.
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_SOURCE_PX = 128; // matches the ingestion quality threshold

export async function POST(req: Request) {
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

  const address = normalizeAddress(rawAddress, info.evm);
  const id = `${chain}:${address}`;

  const raw: RawLogo = { bytes, width: meta.width, height: meta.height };
  const logo = await normalizeLogo(raw, {
    outDir: OVERRIDES_DIR,
    publicBase: OVERRIDES_PUBLIC_BASE,
    chain,
    address,
  });

  await saveOverride(id, logo);

  return NextResponse.json({ id, quality: "curated", logo });
}

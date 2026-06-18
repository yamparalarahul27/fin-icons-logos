import { NextResponse } from "next/server";
import sharp from "sharp";
import { renderLogo, type RawLogo } from "@fin/ingestion/normalize";
import { CHAINS, normalizeAddress, type LogoSet } from "@fin/shared";
import { getStorage } from "@/lib/storage";
import { getOverrideRepo } from "@/lib/overrides-repo";
import { requireAdmin } from "@/lib/admin-guard";

// sharp is a native module — force the Node runtime, not the edge runtime.
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_SOURCE_PX = 128; // matches the ingestion quality threshold

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

  // Render to the canonical sizes, then persist each to the configured storage.
  const raw: RawLogo = { bytes, width: meta.width, height: meta.height };
  const rendered = await renderLogo(raw);
  const storage = getStorage();
  await Promise.all(
    rendered.map(({ size, png }) =>
      storage.put(`${chain}/${address}/${size}.png`, png, "image/png"),
    ),
  );

  const url = (size: number) => storage.urlFor(`${chain}/${address}/${size}.png`);
  const logo: LogoSet = {
    png256: url(256),
    png128: url(128),
    png64: url(64),
    png32: url(32),
    svg: null,
    sourceWidth: meta.width,
    sourceHeight: meta.height,
  };

  await getOverrideRepo().set(id, logo);

  return NextResponse.json({ id, quality: "curated", logo, storage: storage.kind });
}

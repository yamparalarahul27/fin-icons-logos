/** Shared filesystem locations. Next runs with cwd = apps/web. */
import path from "node:path";

const ROOT = process.cwd();

export const PUBLIC_DIR = path.join(ROOT, "public");
export const MANIFEST_PATH = path.join(PUBLIC_DIR, "assets.json");

/** Local fallback location for normalized override PNGs + the URL they serve from. */
export const OVERRIDES_DIR = path.join(PUBLIC_DIR, "overrides");
export const OVERRIDES_PUBLIC_BASE = "/overrides";

/** Local fallback store for override records. */
export const DATA_DIR = path.join(ROOT, "data");
export const OVERRIDES_JSON = path.join(DATA_DIR, "overrides.json");

/**
 * Pluggable store for admin logo overrides (the curation record).
 *
 * Production uses Supabase Postgres (table `logo_overrides`, see
 * supabase/migrations). When Supabase env vars are absent we fall back to a
 * committed JSON sidecar so the app runs with no cloud credentials.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LogoSet } from "@fin/shared";
import { DATA_DIR, OVERRIDES_JSON } from "./paths";

export type OverrideStore = Record<string, LogoSet>;

export interface OverrideRepo {
  readonly kind: "supabase" | "file";
  getAll(): Promise<OverrideStore>;
  set(id: string, logo: LogoSet): Promise<void>;
}

function fileRepo(): OverrideRepo {
  return {
    kind: "file",
    async getAll() {
      try {
        return JSON.parse(await readFile(OVERRIDES_JSON, "utf8")) as OverrideStore;
      } catch {
        return {};
      }
    },
    async set(id, logo) {
      const store = await this.getAll();
      store[id] = logo;
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(OVERRIDES_JSON, JSON.stringify(store, null, 2));
    },
  };
}

const TABLE = "logo_overrides";

interface SupabaseConfig {
  url: string;
  serviceKey: string;
}

function supabaseConfig(): SupabaseConfig | null {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return { url: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_ROLE_KEY };
}

function supabaseRepo(cfg: SupabaseConfig): OverrideRepo {
  let clientPromise: Promise<SupabaseClient> | null = null;
  function client(): Promise<SupabaseClient> {
    if (!clientPromise) {
      clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
        createClient(cfg.url, cfg.serviceKey, { auth: { persistSession: false } }),
      );
    }
    return clientPromise;
  }

  return {
    kind: "supabase",
    async getAll() {
      const sb = await client();
      const { data, error } = await sb.from(TABLE).select("id, logo");
      if (error) throw new Error(`Supabase getAll failed: ${error.message}`);
      const store: OverrideStore = {};
      for (const row of data ?? []) store[row.id as string] = row.logo as LogoSet;
      return store;
    },
    async set(id, logo) {
      const sb = await client();
      const { error } = await sb
        .from(TABLE)
        .upsert({ id, logo, updated_at: new Date().toISOString() });
      if (error) throw new Error(`Supabase set failed: ${error.message}`);
    },
  };
}

export function getOverrideRepo(): OverrideRepo {
  const cfg = supabaseConfig();
  return cfg ? supabaseRepo(cfg) : fileRepo();
}

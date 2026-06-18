import { NextResponse } from "next/server";
import { loadQueue } from "@/lib/manifest";
import { requireAdmin } from "@/lib/admin-guard";

// Always read fresh from disk so newly uploaded overrides show up immediately.
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const queue = await loadQueue();
  return NextResponse.json(queue);
}

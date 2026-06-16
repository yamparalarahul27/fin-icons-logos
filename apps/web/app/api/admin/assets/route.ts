import { NextResponse } from "next/server";
import { loadQueue } from "@/lib/manifest";

// Always read fresh from disk so newly uploaded overrides show up immediately.
export const dynamic = "force-dynamic";

export async function GET() {
  const queue = await loadQueue();
  return NextResponse.json(queue);
}

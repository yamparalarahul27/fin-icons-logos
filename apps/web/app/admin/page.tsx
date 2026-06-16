import { loadQueue } from "@/lib/manifest";
import { UploadQueue } from "./upload-queue";

// The queue reflects on-disk overrides; never cache it.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const queue = await loadQueue();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Logo review queue</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Auto-fetched logos that are low-res or missing float to the top. Upload a
          replacement to override the source — re-ingestion never touches your upload.
        </p>
        {queue.count === 0 ? (
          <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            No assets found. Run <code className="font-mono">pnpm ingest</code> from the
            repo root to populate <code className="font-mono">assets.json</code>, then
            reload.
          </p>
        ) : (
          <p className="mt-3 text-xs text-neutral-500">
            {queue.count} assets
            {queue.generatedAt
              ? ` · ingested ${new Date(queue.generatedAt).toLocaleString()}`
              : ""}
          </p>
        )}
      </header>

      <UploadQueue initialAssets={queue.assets} />
    </main>
  );
}

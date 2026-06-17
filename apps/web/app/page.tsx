import Link from "next/link";
import { loadCatalog } from "../lib/manifest";
import { Explorer } from "./explorer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const assets = await loadCatalog();

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-2 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">fin-icons-logos</h1>
          <p className="mt-1 text-sm text-neutral-400">
            The always-up-to-date registry of crypto token logos.
          </p>
        </div>
        <Link href="/admin" className="shrink-0 text-sm text-neutral-500 hover:text-neutral-300">
          Admin →
        </Link>
      </header>

      <Explorer assets={assets} />
    </main>
  );
}

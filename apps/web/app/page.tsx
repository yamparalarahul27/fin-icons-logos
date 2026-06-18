import { loadCatalog } from "../lib/manifest";
import { Explorer } from "./explorer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const assets = await loadCatalog();

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-10">
      <header className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight">fin-icons-logos</h1>
        <p className="mt-1 text-sm text-neutral-400">
          The always-up-to-date registry of crypto token logos.
        </p>
      </header>

      <Explorer assets={assets} />
    </main>
  );
}

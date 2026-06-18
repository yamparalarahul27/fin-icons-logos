import { loadCatalog } from "../lib/manifest";
import { Explorer } from "./explorer";

export const dynamic = "force-dynamic";

export default async function Home() {
  const assets = await loadCatalog();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 pb-16">
      {/* Minimal wordmark — no nav bar, no banner, no footer. */}
      <div className="pt-6">
        <span className="inline-flex items-center gap-2 text-sm font-medium tracking-tight text-neutral-300">
          <span className="size-3.5 rotate-45 rounded-[3px] bg-gradient-to-br from-sky-400 to-indigo-500" />
          Logobase
        </span>
      </div>

      <header className="pt-16 pb-10 text-center sm:pt-24">
        <h1 className="font-serif text-4xl leading-[1.05] tracking-tight text-neutral-50 sm:text-6xl">
          The <em className="font-normal italic text-neutral-300">complete</em>
          <br />
          crypto logo library
        </h1>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
          {assets.length.toLocaleString()} Logos · Free to use · Copy in one click
        </p>
      </header>

      <Explorer assets={assets} />
    </main>
  );
}

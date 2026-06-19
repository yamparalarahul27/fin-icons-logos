import { loadCatalog } from "../lib/manifest";
import { Explorer } from "./explorer";
import { AgentCta } from "./agent-cta";

export const dynamic = "force-dynamic";

export default async function Home() {
  const assets = await loadCatalog();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 pb-16">
      {/* Minimal centered wordmark — no nav bar, no banner, no footer. */}
      <div className="flex justify-center pt-6">
        <span className="inline-flex items-center gap-2 text-sm font-medium tracking-tight text-neutral-300">
          <span className="size-3.5 rotate-45 rounded-[3px] bg-gradient-to-br from-sky-400 to-indigo-500" />
          Logobase
        </span>
      </div>

      <header className="pb-8 pt-10 text-center sm:pt-12">
        <h1 className="font-serif text-4xl leading-[1.05] tracking-tight text-neutral-50 sm:text-6xl">
          The <em className="font-normal italic text-neutral-300">complete</em>
          <br />
          crypto logo library
        </h1>
        <AgentCta />
      </header>

      <Explorer assets={assets} />
    </main>
  );
}

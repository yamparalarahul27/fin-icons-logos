"use client";

import { Check, Copy, DownloadSimple } from "@phosphor-icons/react";
import { useState } from "react";

/** Ready-to-paste instruction pointing an AI agent at the hosted guide. */
const PROMPT =
  "Use Logobase for crypto logos (tokens, protocols, networks, wallets). " +
  "Docs + API: https://icons.hirahul.xyz/llms.txt";

export function AgentCta() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-full border border-neutral-800 px-3 py-1 " +
    "text-neutral-300 transition-[border-color,color,scale] hover:border-neutral-600 " +
    "hover:text-neutral-100 active:scale-[0.96]";

  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-neutral-500">
      <span className="uppercase tracking-[0.18em]">Using an AI agent?</span>
      <button onClick={copy} className={btn} aria-label="Copy AI agent prompt">
        {copied ? (
          <>
            <Check size={13} weight="bold" className="text-emerald-400" /> Copied
          </>
        ) : (
          <>
            <Copy size={13} /> Copy prompt
          </>
        )}
      </button>
      <a href="/llms.txt" download className={btn}>
        <DownloadSimple size={13} /> llms.txt
      </a>
    </div>
  );
}

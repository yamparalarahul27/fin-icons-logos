"use client";

import dynamic from "next/dynamic";

/**
 * Agentation visual-feedback toolbar (https://agentation.com) — a dev-only aid
 * for handing UI context to coding agents. Loaded client-side with ssr:false so
 * its browser APIs never run during server rendering. Gated to non-production in
 * the root layout, so it's absent from the deployed site.
 */
const Agentation = dynamic(
  () => import("agentation").then((m) => m.Agentation),
  { ssr: false },
);

export function DevAnnotation() {
  return <Agentation />;
}

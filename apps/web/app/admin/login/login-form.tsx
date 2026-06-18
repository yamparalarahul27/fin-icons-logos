"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Login failed (${res.status})`);
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Admin secret"
        autoComplete="current-password"
        className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none transition-colors focus:border-neutral-600"
      />
      <button
        type="submit"
        disabled={busy || !password}
        className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition-[background-color,scale] hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "Checking…" : "Enter"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}

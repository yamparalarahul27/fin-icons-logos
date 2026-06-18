"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const PIN_LENGTH = 4;

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(value: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: value }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Login failed (${res.status})`);
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setPin("");
      setBusy(false);
    }
  }

  function onChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(digits);
    if (error) setError(null);
    if (digits.length === PIN_LENGTH) void submit(digits); // auto-submit when complete
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (pin.length === PIN_LENGTH) void submit(pin);
      }}
      className="mt-6 flex flex-col gap-3"
    >
      <input
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={PIN_LENGTH}
        autoFocus
        value={pin}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter 4-digit PIN"
        aria-label="Admin PIN"
        disabled={busy}
        className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2.5 text-center text-lg tracking-[0.5em] text-neutral-100 placeholder:text-sm placeholder:tracking-normal placeholder:text-neutral-500 outline-none transition-colors focus:border-neutral-600 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={busy || pin.length !== PIN_LENGTH}
        className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition-[background-color,scale] hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "Checking…" : "Enter"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}

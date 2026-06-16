import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">fin-icons-logos</h1>
        <p className="mt-2 text-neutral-400">
          The always-up-to-date registry of crypto token logos.
        </p>
      </div>
      <Link
        href="/admin"
        className="inline-flex w-fit items-center rounded-lg bg-white px-4 py-2 font-medium text-neutral-900 transition hover:bg-neutral-200"
      >
        Open the admin upload queue →
      </Link>
    </main>
  );
}

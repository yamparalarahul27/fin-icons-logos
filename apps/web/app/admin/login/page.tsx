import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only allow same-origin relative paths — never an absolute/protocol-relative URL.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-xl font-semibold tracking-tight">Admin access</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Enter the admin secret to manage the logo review queue.
      </p>
      <LoginForm next={safeNext} />
    </main>
  );
}

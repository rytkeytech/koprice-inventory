import Link from "next/link";
import { Logo } from "@/components/Logo";

// Temporary start page. In phase 2 this sends people to login,
// then to the attendant or owner screens based on their role.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-4 py-10">
      <div className="flex justify-center">
        <Logo size={64} />
      </div>

      <div className="rounded-card border border-line bg-card p-5">
        <h1 className="text-xl font-bold text-brand">Inventory &amp; sales</h1>
        <p className="mt-1 text-muted">
          Setup preview. Pick a set of screens to look at.
        </p>

        <div className="mt-5 grid gap-3">
          <Link
            href="/sell"
            className="flex h-14 items-center justify-center rounded-control bg-brand text-lg font-semibold text-white hover:bg-brand-dark"
          >
            Attendant screens
          </Link>
          <Link
            href="/owner"
            className="flex h-14 items-center justify-center rounded-control border border-input bg-card text-lg font-semibold text-brand hover:bg-success-bg"
          >
            Owner screens
          </Link>
        </div>
      </div>
    </main>
  );
}

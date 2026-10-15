import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Clock, UserX } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { Logo } from "@/components/Logo";
import { getCurrentUser, homePathFor } from "@/lib/auth";

export const metadata: Metadata = { title: "Waiting for approval" };

export default function PendingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex justify-center">
        <Logo size={56} />
      </div>
      <Suspense fallback={<div className="h-64 rounded-card border border-line bg-card" />}>
        <PendingStatus />
      </Suspense>
    </main>
  );
}

async function PendingStatus() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Already approved? Go straight in.
  if (user.role && user.isActive) redirect(homePathFor(user));

  const turnedOff = Boolean(user.role) && !user.isActive;
  const Icon = turnedOff ? UserX : Clock;

  return (
    <div className="space-y-5 rounded-card border border-line bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={`flex size-12 shrink-0 items-center justify-center rounded-full ${
            turnedOff ? "bg-danger/10 text-danger" : "bg-warning-bg text-warning"
          }`}
        >
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-ink">
            {turnedOff ? "Your access is turned off" : "Waiting for owner approval"}
          </h1>
          <p className="mt-1 text-muted">
            {turnedOff
              ? "Please speak to the owner if you think this is a mistake."
              : "Your account has been created. The owner needs to approve it before you can start."}
          </p>
        </div>
      </div>

      <dl className="rounded-control bg-bg p-3 text-sm">
        <div className="flex justify-between gap-3 py-1">
          <dt className="text-muted">Name</dt>
          <dd className="font-semibold">{user.fullName || "Not set"}</dd>
        </div>
        <div className="flex justify-between gap-3 py-1">
          <dt className="text-muted">Email</dt>
          <dd className="truncate font-semibold">{user.email}</dd>
        </div>
      </dl>

      <div className="grid gap-3">
        {/* Plain link: a fresh request re-checks approval status. */}
        <Link
          href="/"
          prefetch={false}
          className="flex h-14 items-center justify-center rounded-control bg-brand text-lg font-bold text-white hover:bg-brand-dark"
        >
          Check again
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-control border border-input bg-card font-semibold text-ink hover:bg-bg"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}

import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { requireRole } from "@/lib/auth";
import { AppNav, NavList } from "./AppNav";
import { HeaderUser } from "./HeaderUser";

type AppShellProps = {
  variant: "attendant" | "owner";
  children: React.ReactNode;
};

// Page frame shared by attendant and owner screens:
// header with logo + user, page content, and the main navigation.
export function AppShell({ variant, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col md:pl-24">
      <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Logo size={36} />
          <Suspense fallback={<div className="h-10 w-28" />}>
            <HeaderUser variant={variant} />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 md:pb-8">
        <Suspense fallback={<PageLoading />}>
          <RoleGate required={variant === "owner" ? "owner" : "staff"}>{children}</RoleGate>
        </Suspense>
      </main>

      <Suspense fallback={<NavList variant={variant} pathname={null} />}>
        <AppNav variant={variant} />
      </Suspense>
    </div>
  );
}

// Only renders the page once the user's role is confirmed.
async function RoleGate({
  required,
  children,
}: {
  required: "staff" | "owner";
  children: React.ReactNode;
}) {
  await requireRole(required);
  return children;
}

function PageLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 animate-pulse rounded-control bg-line" />
      <div className="h-32 animate-pulse rounded-card bg-line/70" />
    </div>
  );
}

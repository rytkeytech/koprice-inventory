import { Logo } from "@/components/Logo";
import { AppNav } from "./AppNav";

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
          {/* Phase 2 replaces this with the signed-in user's name. */}
          <span className="rounded-full bg-success-bg px-3 py-1 text-sm font-semibold text-brand">
            {variant === "owner" ? "Owner" : "Attendant"}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 md:pb-8">
        {children}
      </main>

      <AppNav variant={variant} />
    </div>
  );
}

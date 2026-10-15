import { Logo } from "@/components/Logo";

// Centered card used by login, sign-up and password screens.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex justify-center">
        <Logo size={56} />
      </div>
      <div className="rounded-card border border-line bg-card p-5 shadow-sm">{children}</div>
    </main>
  );
}

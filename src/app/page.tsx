import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { getCurrentUser, homePathFor } from "@/lib/auth";

// Start page: sends each person to the right place for their role.
export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <Suspense fallback={<Logo size={64} />}>
        <RedirectByRole />
      </Suspense>
    </main>
  );
}

async function RedirectByRole() {
  redirect(homePathFor(await getCurrentUser()));
  return null;
}

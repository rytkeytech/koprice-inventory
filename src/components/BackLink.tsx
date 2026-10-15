import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** Small "‹ Back to X" link shown above a page title. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand">
      <ChevronLeft aria-hidden="true" className="size-4" /> {children}
    </Link>
  );
}

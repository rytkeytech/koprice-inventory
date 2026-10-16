import Link from "next/link";
import { House, LogOut, Settings, ShoppingCart } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth";

const iconButton =
  "flex size-11 items-center justify-center rounded-full text-muted hover:bg-success-bg hover:text-brand";

// Right side of the header: who is logged in, plus quick links.
export async function HeaderUser({ variant }: { variant: "attendant" | "owner" }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const firstName = user.fullName.split(" ")[0] || "Me";
  const isOwner = user.role === "owner";

  return (
    <div className="flex items-center gap-1">
      <span className={`mr-1 max-w-32 truncate rounded-full bg-success-bg px-3 py-1 text-sm font-semibold text-brand ${isOwner ? "hidden sm:inline" : ""}`}>
        {firstName}
      </span>

      {/* The owner can also use the selling screens; give a way back and forth. */}
      {isOwner && variant === "owner" && (
        <Link href="/sell" className="mr-1 flex h-11 items-center gap-1.5 rounded-full bg-accent px-3 font-bold text-ink">
          <ShoppingCart aria-hidden="true" className="size-5" /> Sell
        </Link>
      )}
      {isOwner && variant === "attendant" && (
        <Link href="/owner" aria-label="Back to owner home" title="Owner home" className={iconButton}>
          <House aria-hidden="true" className="size-5" />
        </Link>
      )}
      {isOwner && (
        <Link href="/owner/settings" aria-label="Settings" title="Settings" className={iconButton}>
          <Settings aria-hidden="true" className="size-5" />
        </Link>
      )}

      <form action={signOut}>
        <button type="submit" aria-label="Log out" title="Log out" className={iconButton}>
          <LogOut aria-hidden="true" className="size-5" />
        </button>
      </form>
    </div>
  );
}

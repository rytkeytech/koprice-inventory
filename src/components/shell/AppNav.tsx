"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { attendantNav, ownerNav, type NavItem } from "./nav-items";

type Variant = "attendant" | "owner";

// The "/owner" home tab is only active on exactly "/owner";
// other tabs are active on their path and anything below it.
function isActive(pathname: string, item: NavItem, rootHref: string) {
  if (item.href === rootHref) return pathname === rootHref;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Main navigation with the current tab highlighted. */
export function AppNav({ variant }: { variant: Variant }) {
  return <NavList variant={variant} pathname={usePathname()} />;
}

/**
 * Phone: fixed bottom bar. Tablet and up (md): left side rail.
 * With pathname = null nothing is highlighted (used as the loading fallback).
 */
export function NavList({ variant, pathname }: { variant: Variant; pathname: string | null }) {
  const items = variant === "owner" ? ownerNav : attendantNav;
  const rootHref = variant === "owner" ? "/owner" : "";

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:left-0 md:right-auto md:w-24 md:border-t-0 md:border-r md:pb-0 md:pt-20"
    >
      <ul className="flex md:flex-col md:gap-1 md:px-2">
        {items.map((item) => {
          const active = pathname !== null && isActive(pathname, item, rootHref);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1 md:flex-none">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-semibold transition-colors md:rounded-control ${
                  active ? "text-brand md:bg-success-bg" : "text-muted hover:text-brand"
                }`}
              >
                <Icon aria-hidden="true" className="size-6" strokeWidth={active ? 2.4 : 2} />
                <span className="text-center leading-tight">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

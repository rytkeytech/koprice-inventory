import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  KeyRound,
  ScrollText,
  Store,
  Tags,
  Truck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = { title: "Settings" };

type Item = {
  label: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  phase?: number;
};

const items: Item[] = [
  { label: "Staff", description: "Approve sign-ups, set roles, turn access off", icon: Users, href: "/owner/settings/staff" },
  { label: "Change my password", description: "Set a new password for your account", icon: KeyRound, href: "/reset-password" },
  { label: "Shop details", description: "Name, phone and MoMo number on receipts", icon: Store, href: "/owner/settings/shop" },
  { label: "Categories", description: "Product groups like Water and Provisions", icon: Tags, href: "/owner/settings/categories" },
  { label: "Customers", description: "Credit customers and limits", icon: UsersRound, href: "/owner/money/customers" },
  { label: "Suppliers", description: "Who delivers your goods", icon: Truck, href: "/owner/settings/suppliers" },
  { label: "Audit log", description: "Every sensitive change: who and when", icon: ScrollText, href: "/owner/settings/audit" },
];

export default function SettingsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-brand">Settings</h1>
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-success-bg text-brand">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{item.label}</span>
                <span className="block text-sm text-muted">
                  {item.href ? item.description : `Coming in phase ${item.phase}`}
                </span>
              </span>
              {item.href && <ChevronRight aria-hidden="true" className="size-5 text-muted" />}
            </>
          );
          return (
            <li key={item.label}>
              {item.href ? (
                <Link href={item.href} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-bg">
                  {content}
                </Link>
              ) : (
                <div className="flex min-h-16 items-center gap-3 px-4 py-3 opacity-60">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import {
  BarChart3,
  CheckCircle2,
  House,
  Package,
  ShoppingCart,
  Sun,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const attendantNav: NavItem[] = [
  { href: "/sell", label: "Sell", icon: ShoppingCart },
  { href: "/receive", label: "Receive goods", icon: Truck },
  { href: "/my-day", label: "My day", icon: Sun },
];

export const ownerNav: NavItem[] = [
  { href: "/owner", label: "Home", icon: House },
  { href: "/owner/stock", label: "Stock", icon: Package },
  { href: "/owner/money", label: "Money", icon: Wallet },
  { href: "/owner/approvals", label: "Approvals", icon: CheckCircle2 },
  { href: "/owner/reports", label: "Reports", icon: BarChart3 },
];

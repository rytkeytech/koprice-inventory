import { AppShell } from "@/components/shell/AppShell";

export default function OwnerLayout({ children }: LayoutProps<"/owner">) {
  return <AppShell variant="owner">{children}</AppShell>;
}

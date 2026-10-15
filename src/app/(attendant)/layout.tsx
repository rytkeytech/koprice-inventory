import { AppShell } from "@/components/shell/AppShell";

export default function AttendantLayout({ children }: LayoutProps<"/">) {
  return <AppShell variant="attendant">{children}</AppShell>;
}

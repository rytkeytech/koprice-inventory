import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const metadata: Metadata = { title: "Approvals" };

export default function ApprovalsPage() {
  return (
    <PagePlaceholder
      title="Approvals"
      description="Requests from attendants, deliveries to check, and cash-ups to confirm."
      phase={7}
    />
  );
}

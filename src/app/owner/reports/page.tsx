import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <PagePlaceholder
      title="Reports"
      description="Sales, profit, best sellers and slow movers by day, week and month."
      phase={10}
    />
  );
}

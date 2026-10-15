import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const metadata: Metadata = { title: "Home" };

export default function OwnerHomePage() {
  return (
    <PagePlaceholder
      title="Home"
      description="Today's sales, cash, MoMo and credit, profit, and alerts for missing stock and approvals."
      phase={10}
    />
  );
}

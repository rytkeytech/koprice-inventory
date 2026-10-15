import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const metadata: Metadata = { title: "Money" };

export default function MoneyPage() {
  return (
    <PagePlaceholder
      title="Money"
      description="Money owed by customers, cash-ups from attendants, and expenses."
      phase={5}
    />
  );
}

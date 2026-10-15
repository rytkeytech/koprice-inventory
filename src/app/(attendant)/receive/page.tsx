import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const metadata: Metadata = { title: "Receive goods" };

export default function ReceivePage() {
  return (
    <PagePlaceholder
      title="Receive goods"
      description="Record deliveries from suppliers with a photo of the invoice."
      phase={6}
    />
  );
}

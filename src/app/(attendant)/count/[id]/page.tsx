import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { CountSheet, type CountItem } from "@/components/CountSheet";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Count stock" };

export default async function AttendantCountPage({ params }: PageProps<"/count/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("count_sheet", { p_count_id: id });
  if (error || !data) notFound();
  const sheet = data as unknown as { type: string; status: string; items: CountItem[] };

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <BackLink href="/count">Stock counts</BackLink>
      <div>
        <h1 className="text-2xl font-bold text-brand">{sheet.type === "full" ? "Full stock count" : "Spot count"}</h1>
        <p className="text-muted">Count what is really on the shelves and in the store. Count everything, even if it looks the same.</p>
      </div>
      <CountSheet countId={id} items={sheet.items} open={sheet.status === "open"} showExpected={false} />
    </section>
  );
}

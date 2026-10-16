import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Stock count" };

export default async function CountListPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("stock_counts").select("id, type, created_at, note").eq("status", "open").order("created_at");

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <BackLink href="/my-day">My day</BackLink>
      <h1 className="text-2xl font-bold text-brand">Stock count</h1>
      {!data?.length ? (
        <p className="rounded-card border border-dashed border-input bg-card p-6 text-center text-muted">No stock count is open right now.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
          {data.map((c) => (
            <li key={c.id}>
              <Link href={`/count/${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-bg">
                <span className="flex-1">
                  <span className="block font-semibold">{c.type === "full" ? "Full count" : "Spot count"}</span>
                  <span className="block text-sm text-muted">
                    Started {formatDateTime(c.created_at)}
                    {c.note && ` · ${c.note}`}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { ExpenseForm } from "@/components/ExpenseForm";
import { getCurrentUser } from "@/lib/auth";
import { accraDateDaysAgo, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Shop expense" };

export default async function AttendantExpensePage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const { data } = await supabase
    .from("expenses")
    .select("id, expense_date, category, amount, note, status")
    .eq("paid_by", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <BackLink href="/my-day">My day</BackLink>
      <h1 className="text-2xl font-bold text-brand">Money spent for the shop</h1>
      <p className="text-muted">Record money you paid out for the shop (e.g. transport). The owner confirms it.</p>
      <div className="rounded-card border border-line bg-card p-4">
        <ExpenseForm userId={user?.id ?? ""} today={accraDateDaysAgo(0)} isOwner={false} />
      </div>
      {data && data.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
          {data.map((e) => (
            <li key={e.id} className="flex justify-between gap-3 px-4 py-3">
              <span>
                <span className="block font-semibold capitalize">
                  {e.category} · {formatMoney(e.amount)}
                </span>
                <span className="block text-sm text-muted">
                  {formatDate(e.expense_date)}
                  {e.note && ` · ${e.note}`}
                </span>
              </span>
              <span className={`self-center rounded-full px-2.5 py-1 text-xs font-bold ${e.status === "pending" ? "bg-warning-bg text-warning" : e.status === "confirmed" ? "bg-success-bg text-brand" : "bg-danger/10 text-danger"}`}>
                {e.status === "pending" ? "Waiting" : e.status === "confirmed" ? "Confirmed" : "Rejected"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

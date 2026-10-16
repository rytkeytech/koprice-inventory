import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { ExpenseDecision, ExpenseForm } from "@/components/ExpenseForm";
import { getCurrentUser } from "@/lib/auth";
import { accraDateDaysAgo, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const supabase = await createClient();
  const today = accraDateDaysAgo(0);
  const monthStart = `${today.slice(0, 8)}01`;
  const [user, { data }] = await Promise.all([
    getCurrentUser(),
    supabase
      .from("expenses")
      .select("id, expense_date, category, amount, note, status, receipt_photo_url, profiles!expenses_paid_by_fkey(full_name)")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const expenses = data ?? [];
  const paths = expenses.map((e) => e.receipt_photo_url).filter((p): p is string => Boolean(p));
  const signed = paths.length ? (await supabase.storage.from("invoices").createSignedUrls(paths, 3600)).data ?? [] : [];
  const urlFor = new Map(signed.map((s) => [s.path, s.signedUrl]));

  const thisMonth = expenses.filter((e) => e.status === "confirmed" && e.expense_date >= monthStart);
  const byCategory = thisMonth.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.category]: (acc[e.category] ?? 0) + Number(e.amount) }), {});

  return (
    <section className="space-y-4">
      <BackLink href="/owner/money">Money</BackLink>
      <h1 className="text-2xl font-bold text-brand">Expenses</h1>

      <div className="rounded-card border border-line bg-card p-4">
        <p className="text-muted">This month</p>
        <p className="text-3xl font-extrabold">{formatMoney(thisMonth.reduce((s, e) => s + Number(e.amount), 0))}</p>
        <p className="text-sm text-muted capitalize">
          {Object.entries(byCategory)
            .map(([c, v]) => `${c} ${formatMoney(v)}`)
            .join(" · ") || "Nothing yet"}
        </p>
      </div>

      <div className="rounded-card border border-line bg-card p-4">
        <h2 className="mb-3 text-lg font-bold">Add an expense</h2>
        <ExpenseForm userId={user?.id ?? ""} today={today} isOwner />
      </div>

      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
        {expenses.length === 0 && <li className="p-4 text-muted">No expenses yet.</li>}
        {expenses.map((e) => (
          <li key={e.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${e.status === "rejected" ? "opacity-50" : ""}`}>
            <span className="min-w-0">
              <span className="block font-semibold capitalize">
                {e.category} · {formatMoney(e.amount)}
                {e.status === "rejected" && <span className="ml-2 text-sm text-danger normal-case">Rejected</span>}
              </span>
              <span className="block text-sm text-muted">
                {formatDate(e.expense_date)} · {e.profiles?.full_name ?? "?"}
                {e.note && ` · ${e.note}`}
              </span>
              {e.receipt_photo_url && urlFor.get(e.receipt_photo_url) && (
                <a href={urlFor.get(e.receipt_photo_url) ?? "#"} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-brand">
                  View receipt
                </a>
              )}
            </span>
            {e.status === "pending" && <ExpenseDecision id={e.id} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestDecision } from "@/components/ApprovalButtons";
import { BackLink } from "@/components/BackLink";
import { SaleSummary } from "@/components/SaleSummary";
import { getProduct } from "@/lib/catalogue";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Receipt } from "@/lib/receipt";
import { formatStock } from "@/lib/stock";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Request" };

const TITLES: Record<string, string> = {
  discount: "Discount on a sale",
  credit_over_limit: "Credit over the customer's limit",
  refund: "Refund a sale",
  void_sale: "Cancel a sale",
  stock_adjustment: "Stock problem",
  price_change: "Price change",
};

const ADJUST: Record<string, string> = {
  adjust_damaged: "damaged",
  adjust_expired: "expired",
  adjust_stolen: "missing / stolen",
};

type Payload = {
  reason?: string;
  sale_id?: string;
  total?: number;
  discount?: number;
  credit?: number;
  customer_name?: string;
  balance?: number;
  credit_limit?: number;
  product_id?: string;
  product_name?: string;
  pack_id?: string | null;
  units?: number;
  adjust_reason?: string;
  base_unit?: string;
  retail_price?: number;
  wholesale_price?: number;
};

export default async function RequestPage({ params }: PageProps<"/owner/approvals/requests/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: req } = await supabase
    .from("approval_requests")
    .select("*, requester:profiles!approval_requests_requested_by_fkey(full_name), decider:profiles!approval_requests_decided_by_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!req) notFound();

  const p = (req.payload ?? {}) as Payload;
  const receipt = p.sale_id ? ((await supabase.rpc("sale_receipt", { p_sale_id: p.sale_id })).data as unknown as Receipt | null) : null;
  const product = p.product_id ? await getProduct(p.product_id) : null;
  const pack = product && p.pack_id ? product.packs.find((pk) => pk.id === p.pack_id) : null;

  let approveExplain = "The request will be carried out.";
  if (req.type === "discount" || req.type === "credit_over_limit") approveExplain = "The sale is completed: stock goes out and any credit is added to the customer.";
  if (req.type === "refund") approveExplain = "Stock comes back and the customer gets their money (or credit) back.";
  if (req.type === "void_sale") approveExplain = "The sale is cancelled, stock comes back and credit is reversed.";
  if (req.type === "stock_adjustment") approveExplain = `${p.units} ${p.base_unit}s of ${p.product_name} are removed from stock as ${ADJUST[p.adjust_reason ?? ""] ?? "lost"}.`;
  if (req.type === "price_change") approveExplain = "The new prices apply to sales from now on.";

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <BackLink href="/owner/approvals">Approvals</BackLink>
      <div>
        <h1 className="text-2xl font-bold text-brand">{TITLES[req.type] ?? req.type}</h1>
        <p className="text-muted">
          Asked by {req.requester?.full_name ?? "?"} · {formatDateTime(req.created_at)}
        </p>
      </div>

      {p.reason && (
        <blockquote className="rounded-card border-l-4 border-accent bg-card p-4">
          <p className="text-sm text-muted">Their reason</p>
          <p className="text-lg">{p.reason}</p>
        </blockquote>
      )}

      {(req.type === "discount" || req.type === "credit_over_limit") && (
        <dl className="grid grid-cols-2 gap-3 rounded-card border border-line bg-card p-4 text-sm">
          {Number(p.discount) > 0 && <Fact label="Discount asked" value={formatMoney(p.discount ?? 0)} />}
          {Number(p.credit) > 0 && <Fact label="Credit asked" value={formatMoney(p.credit ?? 0)} />}
          {p.customer_name && <Fact label="Customer" value={p.customer_name} />}
          {p.customer_name && <Fact label="Owes now / limit" value={`${formatMoney(p.balance ?? 0)} / ${formatMoney(p.credit_limit ?? 0)}`} />}
        </dl>
      )}

      {req.type === "price_change" && product && (
        <dl className="grid grid-cols-2 gap-3 rounded-card border border-line bg-card p-4 text-sm">
          <Fact label="Item" value={`${product.name}${pack ? ` (${pack.name})` : ""}`} />
          <Fact label="Retail now → new" value={`${formatMoney(pack ? pack.retail_price : product.retail_price)} → ${formatMoney(p.retail_price ?? 0)}`} />
          <Fact label="Wholesale now → new" value={`${formatMoney(pack ? pack.wholesale_price : product.wholesale_price)} → ${formatMoney(p.wholesale_price ?? 0)}`} />
        </dl>
      )}

      {req.type === "stock_adjustment" && product && (
        <dl className="grid grid-cols-2 gap-3 rounded-card border border-line bg-card p-4 text-sm">
          <Fact label="Item" value={product.name} />
          <Fact label="Problem" value={`${p.units} ${p.base_unit}s ${ADJUST[p.adjust_reason ?? ""] ?? ""}`} />
          <Fact label="In stock now" value={formatStock(product.stock_units, product.base_unit_name, product.packs)} />
        </dl>
      )}

      {receipt && (
        <>
          <SaleSummary receipt={receipt} />
          <Link href={`/owner/sales/${receipt.sale_id}`} className="text-sm font-semibold text-brand">
            Open sale
          </Link>
        </>
      )}

      {req.status === "pending" ? (
        <RequestDecision requestId={req.id} approveExplain={approveExplain} />
      ) : (
        <p className={`rounded-control p-3 font-semibold ${req.status === "approved" ? "bg-success-bg text-brand" : "bg-danger/10 text-danger"}`}>
          {req.status === "approved" ? "Approved" : "Rejected"} by {req.decider?.full_name ?? "?"} · {formatDateTime(req.decided_at)}
          {req.reason && ` · “${req.reason}”`}
        </p>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

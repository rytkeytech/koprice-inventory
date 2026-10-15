import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Receipt } from "@/lib/receipt";

export const SALE_STATUS: Record<string, { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-success-bg text-brand" },
  held_for_approval: { label: "Waiting for owner", className: "bg-warning-bg text-warning" },
  refunded: { label: "Refunded", className: "bg-info-bg text-info" },
  void: { label: "Cancelled", className: "bg-danger/10 text-danger" },
};

/** Receipt-style view of one sale (used by owner and attendant pages). */
export function SaleSummary({ receipt }: { receipt: Receipt }) {
  const status = SALE_STATUS[receipt.status] ?? SALE_STATUS.completed;
  return (
    <div className="space-y-3 rounded-card border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">Receipt {receipt.receipt_no}</p>
          <p className="text-sm text-muted">
            {formatDateTime(receipt.created_at)} · {receipt.attendant_name ?? "?"} · {receipt.price_mode}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
      </div>
      <ul className="space-y-1 text-sm">
        {receipt.items.map((item, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span>
              {item.qty} × {item.name}
              {item.pack_name ? ` (${item.pack_name})` : ""} @ {formatMoney(item.unit_price)}
            </span>
            <span className="font-semibold">{formatMoney(item.line_total)}</span>
          </li>
        ))}
      </ul>
      <dl className="space-y-1 border-t border-line pt-2 text-sm">
        {Number(receipt.discount) > 0 && <Line label="Discount" value={`−${formatMoney(receipt.discount)}`} />}
        <Line label="Total" value={formatMoney(receipt.total)} strong />
        {Number(receipt.paid_cash) > 0 && <Line label="Cash" value={formatMoney(receipt.paid_cash)} />}
        {Number(receipt.change_given) > 0 && <Line label="Change" value={formatMoney(receipt.change_given)} />}
        {Number(receipt.paid_momo) > 0 && <Line label={`MoMo${receipt.momo_txn_id ? ` (${receipt.momo_txn_id})` : ""}`} value={formatMoney(receipt.paid_momo)} />}
        {Number(receipt.credit_amount) > 0 && <Line label={`Credit – ${receipt.customer?.name ?? ""}`} value={formatMoney(receipt.credit_amount)} />}
      </dl>
      {receipt.note && <p className="rounded-control bg-bg p-2 text-sm">Note: {receipt.note}</p>}
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "text-base font-bold" : "text-muted"}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

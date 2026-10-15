"use client";

import { ChevronLeft, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form";
import { formatMoney } from "@/lib/money";
import { fromPesewas, settle, toPesewas, type PriceMode } from "@/lib/pricing";
import type { Receipt } from "@/lib/receipt";
import { completeSale } from "./actions";
import { CustomerPicker } from "./CustomerPicker";
import { priceOf, type CartLine, type SellCustomer, type SellOptionView } from "@/lib/sell-options";

type Method = "cash" | "momo" | "credit" | "split";

type Props = {
  lines: (CartLine & { option: SellOptionView })[];
  mode: PriceMode;
  totalPesewas: number;
  customers: SellCustomer[];
  isOwner: boolean;
  onBack: () => void;
  onDone: (receipt: Receipt) => void;
};

const input = "h-12 w-full rounded-control border border-input bg-card px-3 text-base";
const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

export function PaymentPanel({ lines, mode, totalPesewas, customers, isOwner, onBack, onDone }: Props) {
  const [method, setMethod] = useState<Method>("cash");
  const [cashGiven, setCashGiven] = useState("");
  const [momo, setMomo] = useState("");
  const [txn, setTxn] = useState("");
  const [credit, setCredit] = useState("");
  const [customer, setCustomer] = useState<SellCustomer | null>(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discount, setDiscount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();
  // One reference per sale: if the internet drops and we retry, it is not sold twice.
  const [clientRef] = useState(() => crypto.randomUUID());

  const discountPesewas = Math.min(toPesewas(num(discount)), totalPesewas);
  const due = totalPesewas - discountPesewas;
  const dueCedis = fromPesewas(due);

  const payment =
    method === "cash"
      ? { cash: cashGiven.trim() === "" ? dueCedis : num(cashGiven), momo: 0, credit: 0 }
      : method === "momo"
        ? { cash: 0, momo: dueCedis, credit: 0 }
        : method === "credit"
          ? { cash: 0, momo: 0, credit: dueCedis }
          : { cash: num(cashGiven), momo: num(momo), credit: num(credit) };

  const check = settle(due, payment);
  const needsCustomer = payment.credit > 0;
  const overLimit =
    !isOwner && customer !== null && payment.credit > 0 && customer.balance + payment.credit > customer.credit_limit;
  const needsApproval = (!isOwner && discountPesewas > 0) || overLimit;

  function submit() {
    setError(undefined);
    if (!check.ok) return setError(check.reason);
    if (needsCustomer && !customer) return setError("Choose the customer who is taking credit.");
    if (payment.momo > 0 && !txn.trim()) return setError("Enter the MoMo transaction ID.");
    if (needsApproval && !reason.trim()) return setError("Give a reason for the owner.");

    startSaving(async () => {
      const result = await completeSale({
        items: lines.map((l) => ({ product_id: l.option.product.id, pack_id: l.option.packId, qty: l.qty })),
        priceMode: mode,
        customerId: customer?.id ?? null,
        payment: { ...payment, momo_txn_id: txn.trim() },
        discount: fromPesewas(discountPesewas),
        clientRef,
        note: reason.trim(),
      });
      if (result.ok) onDone(result.receipt);
      else setError(result.error);
    });
  }

  const methods: { id: Method; label: string }[] = [
    { id: "cash", label: "Cash" },
    { id: "momo", label: "MoMo" },
    { id: "credit", label: "Credit (pay later)" },
    { id: "split", label: "Split" },
  ];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand">
        <ChevronLeft aria-hidden="true" className="size-4" /> Back to sale
      </button>

      <div className="rounded-card border border-line bg-card p-4 text-center">
        <p className="text-muted">
          {lines.length} item{lines.length === 1 ? "" : "s"} · {mode}
        </p>
        <p className="text-4xl font-extrabold text-ink">{formatMoney(dueCedis)}</p>
        {discountPesewas > 0 && (
          <p className="text-sm text-muted">
            {formatMoney(fromPesewas(totalPesewas))} − discount {formatMoney(fromPesewas(discountPesewas))}
          </p>
        )}
      </div>

      <details className="rounded-card border border-line bg-card p-4 text-sm" open={false}>
        <summary className="cursor-pointer font-semibold">Items</summary>
        <ul className="mt-2 space-y-1">
          {lines.map((l) => (
            <li key={l.key} className="flex justify-between gap-2">
              <span>
                {l.qty} × {l.option.product.name} ({l.option.label})
              </span>
              <span>{formatMoney(priceOf(l.option, mode, l.qty) * l.qty)}</span>
            </li>
          ))}
        </ul>
      </details>

      <div role="group" aria-label="Payment method" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={method === m.id}
            onClick={() => setMethod(m.id)}
            className={`min-h-14 rounded-control px-2 font-bold ${method === m.id ? "bg-brand text-white" : "border border-input bg-card text-ink"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 rounded-card border border-line bg-card p-4">
        {(method === "cash" || method === "split") && (
          <div className="space-y-2">
            <label htmlFor="cash" className="block font-semibold">
              Cash received (GH₵)
            </label>
            <input id="cash" className={`${input} text-xl font-bold`} type="number" inputMode="decimal" step="0.01" min="0" placeholder={method === "cash" ? dueCedis.toFixed(2) : "0.00"} value={cashGiven} onChange={(e) => setCashGiven(e.target.value)} />
            {method === "cash" && (
              <div className="flex flex-wrap gap-2">
                {[5, 10, 20, 50, 100, 200].filter((n) => n * 100 >= due).slice(0, 4).map((n) => (
                  <button key={n} type="button" onClick={() => setCashGiven(String(n))} className="h-11 rounded-control border border-input px-4 font-semibold">
                    GH₵ {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {(method === "momo" || method === "split") && (
          <div className="grid gap-3 sm:grid-cols-2">
            {method === "split" && (
              <label className="block space-y-1">
                <span className="font-semibold">MoMo amount (GH₵)</span>
                <input className={input} type="number" inputMode="decimal" step="0.01" min="0" value={momo} onChange={(e) => setMomo(e.target.value)} />
              </label>
            )}
            <label className="block space-y-1">
              <span className="font-semibold">MoMo transaction ID</span>
              <input className={input} value={txn} onChange={(e) => setTxn(e.target.value)} autoComplete="off" placeholder="From the MoMo message" />
            </label>
          </div>
        )}

        {method === "split" && (
          <label className="block space-y-1">
            <span className="font-semibold">On credit (GH₵)</span>
            <input className={input} type="number" inputMode="decimal" step="0.01" min="0" value={credit} onChange={(e) => setCredit(e.target.value)} />
          </label>
        )}

        {(needsCustomer || method === "credit") && (
          <div className="space-y-2">
            <p className="font-semibold">Customer taking credit</p>
            <CustomerPicker customers={customers} selected={customer} onSelect={setCustomer} />
          </div>
        )}

        {check.ok ? (
          check.change > 0 && (
            <p className="rounded-control bg-success-bg p-3 text-center text-lg">
              Change to give: <strong className="text-2xl">{formatMoney(fromPesewas(check.change))}</strong>
            </p>
          )
        ) : (
          (method === "split" || cashGiven.trim() !== "") && (
            <p className="rounded-control bg-warning-bg p-3 text-center text-warning">
              {check.reason}
              {"short" in check && check.short ? ` ${formatMoney(fromPesewas(check.short))} still to pay.` : ""}
            </p>
          )
        )}
      </div>

      <div className="space-y-3 rounded-card border border-line bg-card p-4">
        {!showDiscount ? (
          <button type="button" onClick={() => setShowDiscount(true)} className="min-h-11 font-semibold text-brand">
            {isOwner ? "Give a discount" : "Ask owner for a discount"}
          </button>
        ) : (
          <label className="block space-y-1">
            <span className="font-semibold">Discount (GH₵ off)</span>
            <input className={input} type="number" inputMode="decimal" step="0.01" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </label>
        )}

        {needsApproval && (
          <div className="space-y-2 rounded-control bg-warning-bg p-3">
            <p className="text-warning">
              {overLimit
                ? `This is over ${customer?.name}'s credit limit (${formatMoney(customer?.credit_limit ?? 0)}).`
                : "Discounts need the owner's approval."}{" "}
              The sale will wait for the owner. Nothing leaves stock until it is approved.
            </p>
            <label className="block space-y-1">
              <span className="font-semibold">Reason for the owner</span>
              <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Regular customer, pays on Friday" />
            </label>
          </div>
        )}
      </div>

      <FormAlert error={error} />

      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="flex h-[60px] w-full items-center justify-center gap-2 rounded-control bg-accent text-lg font-bold text-ink disabled:opacity-60"
      >
        {saving && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
        {saving ? "Saving…" : needsApproval ? "Send to owner for approval" : "Complete sale"}
      </button>
    </div>
  );
}

"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form";
import { recordCreditPayment, type PaymentResult } from "@/lib/actions/credit";
import { formatMoney } from "@/lib/money";

export type PayingCustomer = { id: string; name: string; phone: string | null; balance: number };

type Props = {
  /** Either a fixed customer, or a list to choose from. */
  customer?: PayingCustomer;
  customers?: PayingCustomer[];
};

const input = "h-12 w-full rounded-control border border-input bg-card px-3 text-base";

export function RecordPaymentForm({ customer: fixed, customers = [] }: Props) {
  const [chosenId, setChosenId] = useState(fixed?.id ?? "");
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "momo">("cash");
  const [txn, setTxn] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<PaymentResult>();
  const [saving, startSaving] = useTransition();

  const owing = customers.filter((c) => c.balance > 0);
  const customer = fixed ?? owing.find((c) => c.id === chosenId);
  const q = query.trim().toLowerCase();
  const matches = q ? owing.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)) : owing;

  if (result?.ok) {
    return (
      <div className="space-y-3 rounded-card bg-success-bg p-5 text-center">
        <CheckCircle2 aria-hidden="true" className="mx-auto size-10 text-brand" />
        <p className="text-lg font-bold text-brand">
          {formatMoney(result.amount)} received from {result.customerName}
        </p>
        <p>
          They now owe <strong>{formatMoney(result.balance)}</strong>.
        </p>
        <button
          type="button"
          onClick={() => {
            setResult(undefined);
            setAmount("");
            setTxn("");
            setNote("");
            if (!fixed) setChosenId("");
          }}
          className="h-12 rounded-control border border-input bg-card px-4 font-semibold"
        >
          Record another payment
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startSaving(async () =>
          setResult(
            await recordCreditPayment({
              customerId: customer?.id ?? "",
              amount: Number(amount),
              method,
              momoTxnId: txn.trim(),
              note,
            }),
          ),
        );
      }}
    >
      {!fixed && (
        <div className="space-y-2">
          <p className="font-semibold">Who is paying?</p>
          {customer ? (
            <div className="flex items-center justify-between rounded-control border border-brand bg-success-bg p-3">
              <span>
                <span className="block font-bold">{customer.name}</span>
                <span className="text-sm">Owes {formatMoney(customer.balance)}</span>
              </span>
              <button type="button" onClick={() => setChosenId("")} className="min-h-11 font-semibold text-brand">
                Change
              </button>
            </div>
          ) : (
            <>
              <input type="search" aria-label="Find customer" placeholder="Find by name or phone" className={input} value={query} onChange={(e) => setQuery(e.target.value)} />
              <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-control border border-line">
                {matches.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => setChosenId(c.id)} className="flex min-h-12 w-full items-center justify-between px-3 py-2 text-left hover:bg-bg">
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-sm text-warning">Owes {formatMoney(c.balance)}</span>
                    </button>
                  </li>
                ))}
                {matches.length === 0 && <li className="p-3 text-muted">No customer owing money matches.</li>}
              </ul>
            </>
          )}
        </div>
      )}

      {customer && (
        <>
          <label className="block space-y-1">
            <span className="font-semibold">Amount paid (GH₵)</span>
            <input className={`${input} text-xl font-bold`} type="number" inputMode="decimal" step="0.01" min="0.01" max={customer.balance} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button type="button" onClick={() => setAmount(customer.balance.toFixed(2))} className="min-h-11 text-sm font-semibold text-brand">
              Paying everything ({formatMoney(customer.balance)})
            </button>
          </label>

          <div role="group" aria-label="Paid by" className="grid grid-cols-2 gap-2">
            {(["cash", "momo"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)} className={`h-12 rounded-control font-bold ${method === m ? "bg-brand text-white" : "border border-input bg-card"}`}>
                {m === "cash" ? "Cash" : "MoMo"}
              </button>
            ))}
          </div>

          {method === "momo" && (
            <label className="block space-y-1">
              <span className="font-semibold">MoMo transaction ID</span>
              <input className={input} value={txn} onChange={(e) => setTxn(e.target.value)} autoComplete="off" />
            </label>
          )}

          <label className="block space-y-1">
            <span className="font-semibold">Note (optional)</span>
            <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          {result && !result.ok && <FormAlert error={result.error} />}

          <button type="submit" disabled={saving} className="flex h-14 w-full items-center justify-center gap-2 rounded-control bg-brand text-lg font-bold text-white disabled:opacity-60">
            {saving && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
            Save payment
          </button>
        </>
      )}
    </form>
  );
}

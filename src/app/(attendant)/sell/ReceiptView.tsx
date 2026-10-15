"use client";

import { CheckCircle2, Clock, MessageCircle } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { receiptText, whatsappLink, type Receipt, type ShopInfo } from "@/lib/receipt";

type Props = {
  receipt: Receipt;
  shop: ShopInfo;
  onNewSale: () => void;
};

export function ReceiptView({ receipt, shop, onNewSale }: Props) {
  const [phone, setPhone] = useState(receipt.customer?.phone ?? "");
  const held = receipt.status === "held_for_approval";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className={`flex flex-col items-center gap-2 rounded-card p-6 text-center ${held ? "bg-warning-bg" : "bg-success-bg"}`}>
        {held ? <Clock aria-hidden="true" className="size-12 text-warning" /> : <CheckCircle2 aria-hidden="true" className="size-12 text-brand" />}
        <h1 className={`text-2xl font-bold ${held ? "text-warning" : "text-brand"}`}>{held ? "Waiting for owner approval" : "Sale complete"}</h1>
        <p className="font-semibold">Receipt {receipt.receipt_no}</p>
        {held && <p className="text-warning">Don&apos;t hand over the goods until the owner approves. You&apos;ll see it in My day.</p>}
        {!held && Number(receipt.change_given) > 0 && (
          <p className="text-lg">
            Change: <strong className="text-2xl">{formatMoney(receipt.change_given)}</strong>
          </p>
        )}
      </div>

      <div className="rounded-card border border-line bg-card p-4 text-sm">
        <ul className="space-y-1">
          {receipt.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                {item.qty} × {item.name}
                {item.pack_name ? ` (${item.pack_name})` : ""}
              </span>
              <span className="font-semibold">{formatMoney(item.line_total)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-line pt-3">
          {Number(receipt.discount) > 0 && (
            <div className="flex justify-between">
              <dt>Discount</dt>
              <dd>−{formatMoney(receipt.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold">
            <dt>Total</dt>
            <dd>{formatMoney(receipt.total)}</dd>
          </div>
          {Number(receipt.paid_cash) > 0 && (
            <div className="flex justify-between text-muted">
              <dt>Cash</dt>
              <dd>{formatMoney(receipt.paid_cash)}</dd>
            </div>
          )}
          {Number(receipt.paid_momo) > 0 && (
            <div className="flex justify-between text-muted">
              <dt>MoMo</dt>
              <dd>{formatMoney(receipt.paid_momo)}</dd>
            </div>
          )}
          {Number(receipt.credit_amount) > 0 && (
            <div className="flex justify-between text-muted">
              <dt>Credit ({receipt.customer?.name})</dt>
              <dd>{formatMoney(receipt.credit_amount)}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="space-y-2 rounded-card border border-line bg-card p-4">
        <label htmlFor="wa-phone" className="block font-semibold">
          Customer WhatsApp number (optional)
        </label>
        <input id="wa-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024 123 4567" className="h-12 w-full rounded-control border border-input px-3 text-base" />
        <a
          href={whatsappLink(receiptText(receipt, shop), phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-14 items-center justify-center gap-2 rounded-control bg-[#1f7a3a] text-lg font-bold text-white"
        >
          <MessageCircle aria-hidden="true" className="size-5" /> Send on WhatsApp
        </a>
      </div>

      <button type="button" onClick={onNewSale} className="h-[58px] w-full rounded-control bg-accent text-lg font-bold text-ink">
        New sale
      </button>
    </div>
  );
}

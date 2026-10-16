"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form";
import { saveShopSettings, type ShopSettingsInput } from "./actions";

const input = "h-12 w-full rounded-control border border-input bg-card px-3 text-base";

export function ShopForm({ initial }: { initial: ShopSettingsInput }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();
  const set = <K extends keyof ShopSettingsInput>(k: K, v: ShopSettingsInput[K]) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const fields: { key: keyof ShopSettingsInput; label: string; hint?: string; type?: string }[] = [
    { key: "shop_name", label: "Shop name" },
    { key: "phone", label: "Shop phone (on receipts)", type: "tel" },
    { key: "location", label: "Location" },
    { key: "momo_number", label: "MoMo number for payments", type: "tel", hint: "Shown on receipts and credit reminders." },
    { key: "momo_name", label: "MoMo account name" },
    { key: "receipt_footer", label: "Message at the end of receipts", hint: "e.g. Thank you! Goods sold are not returnable after 3 days." },
  ];

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startSaving(async () => {
          setError(undefined);
          const r = await saveShopSettings(form);
          if (!r.ok) setError(r.error);
          else setSaved(true);
        });
      }}
    >
      {fields.map((f) => (
        <label key={f.key} className="block space-y-1">
          <span className="font-semibold">{f.label}</span>
          <input className={input} type={f.type ?? "text"} value={String(form[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value as never)} />
          {f.hint && <span className="block text-sm text-muted">{f.hint}</span>}
        </label>
      ))}
      <label className="block space-y-1">
        <span className="font-semibold">Default low-stock level (units)</span>
        <input className={input} type="number" inputMode="numeric" min="0" value={form.low_stock_default} onChange={(e) => set("low_stock_default", Number(e.target.value) || 0)} />
        <span className="block text-sm text-muted">Used for products that don&apos;t have their own low-stock level.</span>
      </label>
      <FormAlert error={error} message={saved ? "Saved." : undefined} />
      <button type="submit" disabled={saving} className="flex h-14 w-full items-center justify-center gap-2 rounded-control bg-brand text-lg font-bold text-white disabled:opacity-60">
        {saving && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
        Save
      </button>
    </form>
  );
}

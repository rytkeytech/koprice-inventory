"use client";

import { Camera, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form";
import type { Category, Product } from "@/lib/catalogue";
import { compressImage, extensionFor } from "@/lib/image";
import { formatMoney } from "@/lib/money";
import { formatStock } from "@/lib/stock";
import { createClient } from "@/lib/supabase/client";
import { saveProduct, type PackInput, type ProductInput } from "./actions";

type Props = {
  product?: Product;
  costPerUnit?: number | null;
  categories: Category[];
};

const UNIT_SUGGESTIONS = ["piece", "sachet", "bottle", "tin", "bar", "packet", "can", "roll", "bag", "kg"];

const input =
  "h-12 w-full rounded-control border border-input bg-card px-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

function emptyPack(): PackInput {
  return {
    name: "",
    units_per_pack: 0,
    barcode: "",
    retail_price: "",
    wholesale_price: "",
    min_wholesale_qty: 1,
    is_quick_sell: false,
    is_active: true,
  };
}

export function ProductForm({ product, costPerUnit, categories }: Props) {
  const isNew = !product;
  const [form, setForm] = useState<ProductInput>(() => ({
    id: product?.id,
    name: product?.name ?? "",
    category_id: product?.category_id ?? "",
    brand: product?.brand ?? "",
    base_unit_name: product?.base_unit_name ?? "piece",
    barcode: product?.barcode ?? "",
    retail_price: product ? String(product.retail_price) : "",
    wholesale_price: product ? String(product.wholesale_price) : "",
    min_wholesale_qty: product?.min_wholesale_qty ?? 1,
    reorder_level: product?.reorder_level ?? 0,
    is_quick_sell: product?.is_quick_sell ?? false,
    is_active: product?.is_active ?? true,
    photo_url: product?.photo_url ?? "",
    cost_per_unit: costPerUnit != null ? String(costPerUnit) : "",
    opening_stock: 0,
    packs: (product?.packs ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      units_per_pack: p.units_per_pack,
      barcode: p.barcode ?? "",
      retail_price: String(p.retail_price),
      wholesale_price: String(p.wholesale_price),
      min_wholesale_qty: p.min_wholesale_qty,
      is_quick_sell: p.is_quick_sell,
      is_active: p.is_active,
    })),
  }));
  // Cost can be typed per unit or per pack; we store per base unit.
  const [costInput, setCostInput] = useState(form.cost_per_unit);
  const [costPer, setCostPer] = useState<number>(1);
  // Opening stock can be typed as packs + loose units.
  const [openingPacks, setOpeningPacks] = useState(0);
  const [openingLoose, setOpeningLoose] = useState(0);
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();
  const [uploading, setUploading] = useState(false);
  const ids = useId();

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setPack = (index: number, patch: Partial<PackInput>) =>
    setForm((f) => ({ ...f, packs: f.packs.map((p, i) => (i === index ? { ...p, ...patch } : p)) }));

  const unit = form.base_unit_name.trim() || "unit";
  const firstPack = form.packs.find((p) => p.is_active && p.units_per_pack > 1);
  const openingUnits = openingPacks * (firstPack?.units_per_pack ?? 0) + openingLoose;
  const costPerUnitValue = costInput.trim() === "" ? "" : String(Number(costInput) / costPer);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const supabase = createClient();
      const path = `products/${crypto.randomUUID()}.${extensionFor(blob)}`;
      const { error: uploadError } = await supabase.storage
        .from("product-photos")
        .upload(path, blob, { contentType: blob.type, upsert: false });
      if (uploadError) throw uploadError;
      set("photo_url", supabase.storage.from("product-photos").getPublicUrl(path).data.publicUrl);
    } catch {
      setError("Could not upload the photo. Check your internet and try again.");
    } finally {
      setUploading(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    startSaving(async () => {
      const result = await saveProduct({
        ...form,
        cost_per_unit: costPerUnitValue,
        opening_stock: isNew ? openingUnits : 0,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Card title="Product">
        <div className="flex items-center gap-4">
          {form.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.photo_url} alt="Product photo" className="size-20 rounded-control object-cover" />
          ) : (
            <span className="flex size-20 items-center justify-center rounded-control bg-bg text-muted">
              <Camera aria-hidden="true" className="size-7" />
            </span>
          )}
          <label className="flex h-12 cursor-pointer items-center gap-2 rounded-control border border-input px-4 font-semibold">
            {uploading ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <Camera aria-hidden="true" className="size-5" />}
            {form.photo_url ? "Change photo" : "Add photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => onPhoto(e.target.files?.[0])}
            />
          </label>
          {form.photo_url && (
            <button type="button" onClick={() => set("photo_url", "")} className="text-sm font-semibold text-danger">
              Remove
            </button>
          )}
        </div>

        <Labeled label="Name *" htmlFor={`${ids}-name`}>
          <input id={`${ids}-name`} className={input} value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </Labeled>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Category" htmlFor={`${ids}-cat`}>
            <select id={`${ids}-cat`} className={input} value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
              <option value="">No category</option>
              {categories
                .filter((c) => c.is_active || c.id === form.category_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Labeled>
          <Labeled label="Brand" htmlFor={`${ids}-brand`}>
            <input id={`${ids}-brand`} className={input} value={form.brand} onChange={(e) => set("brand", e.target.value)} />
          </Labeled>
          <Labeled label="Single unit is a…" htmlFor={`${ids}-unit`} hint="The smallest thing you sell, e.g. sachet, bottle, tin.">
            <input
              id={`${ids}-unit`}
              className={input}
              list={`${ids}-units`}
              value={form.base_unit_name}
              onChange={(e) => set("base_unit_name", e.target.value)}
              required
            />
            <datalist id={`${ids}-units`}>
              {UNIT_SUGGESTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Labeled>
          <Labeled label="Barcode" htmlFor={`${ids}-barcode`} hint="Optional. Scan with a scanner or type it.">
            <input
              id={`${ids}-barcode`}
              className={input}
              inputMode="numeric"
              value={form.barcode}
              onChange={(e) => set("barcode", e.target.value)}
            />
          </Labeled>
        </div>
      </Card>

      <Card title={`Price for 1 ${unit}`}>
        <div className="grid grid-cols-2 gap-4">
          <Labeled label="Retail price (GH₵) *" htmlFor={`${ids}-rp`}>
            <input id={`${ids}-rp`} className={input} type="number" inputMode="decimal" step="0.01" min="0.01" value={form.retail_price} onChange={(e) => set("retail_price", e.target.value)} required />
          </Labeled>
          <Labeled label="Wholesale price (GH₵) *" htmlFor={`${ids}-wp`}>
            <input id={`${ids}-wp`} className={input} type="number" inputMode="decimal" step="0.01" min="0.01" value={form.wholesale_price} onChange={(e) => set("wholesale_price", e.target.value)} required />
          </Labeled>
          <Labeled label="Wholesale from (qty)" htmlFor={`${ids}-mwq`} hint="Below this, retail price is charged.">
            <input id={`${ids}-mwq`} className={input} type="number" inputMode="numeric" min="1" value={form.min_wholesale_qty} onChange={(e) => set("min_wholesale_qty", Number(e.target.value) || 1)} />
          </Labeled>
        </div>
      </Card>

      <Card title="Packs (sell in bulk)">
        <p className="text-sm text-muted">Add a pack if this item is also sold as a bag, carton, crate or bundle.</p>
        {form.packs.map((pack, i) => (
          <fieldset key={pack.id ?? `new-${i}`} className={`space-y-3 rounded-control border border-line p-3 ${pack.is_active ? "" : "opacity-60"}`}>
            <legend className="px-1 text-sm font-bold">{pack.name || "New pack"}</legend>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Pack name" htmlFor={`${ids}-pn${i}`}>
                <input id={`${ids}-pn${i}`} className={input} placeholder="Bag" value={pack.name} onChange={(e) => setPack(i, { name: e.target.value })} />
              </Labeled>
              <Labeled label={`${unit}s in one pack`} htmlFor={`${ids}-pu${i}`}>
                <input id={`${ids}-pu${i}`} className={input} type="number" inputMode="numeric" min="2" value={pack.units_per_pack || ""} onChange={(e) => setPack(i, { units_per_pack: Number(e.target.value) })} />
              </Labeled>
              <Labeled label="Retail price (GH₵)" htmlFor={`${ids}-pr${i}`}>
                <input id={`${ids}-pr${i}`} className={input} type="number" inputMode="decimal" step="0.01" value={pack.retail_price} onChange={(e) => setPack(i, { retail_price: e.target.value })} />
              </Labeled>
              <Labeled label="Wholesale price (GH₵)" htmlFor={`${ids}-pw${i}`}>
                <input id={`${ids}-pw${i}`} className={input} type="number" inputMode="decimal" step="0.01" value={pack.wholesale_price} onChange={(e) => setPack(i, { wholesale_price: e.target.value })} />
              </Labeled>
              <Labeled label="Wholesale from (packs)" htmlFor={`${ids}-pm${i}`}>
                <input id={`${ids}-pm${i}`} className={input} type="number" inputMode="numeric" min="1" value={pack.min_wholesale_qty} onChange={(e) => setPack(i, { min_wholesale_qty: Number(e.target.value) || 1 })} />
              </Labeled>
              <Labeled label="Pack barcode" htmlFor={`${ids}-pb${i}`}>
                <input id={`${ids}-pb${i}`} className={input} inputMode="numeric" value={pack.barcode} onChange={(e) => setPack(i, { barcode: e.target.value })} />
              </Labeled>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Check label="Quick sell button" checked={pack.is_quick_sell} onChange={(v) => setPack(i, { is_quick_sell: v })} />
              {pack.id ? (
                <Check label="Can be sold" checked={pack.is_active} onChange={(v) => setPack(i, { is_active: v })} />
              ) : (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, packs: f.packs.filter((_, j) => j !== i) }))}
                  className="flex min-h-11 items-center gap-1 text-sm font-semibold text-danger"
                >
                  <Trash2 aria-hidden="true" className="size-4" /> Remove
                </button>
              )}
            </div>
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, packs: [...f.packs, emptyPack()] }))}
          className="flex h-12 items-center gap-2 rounded-control border border-dashed border-input px-4 font-semibold text-brand"
        >
          <Plus aria-hidden="true" className="size-5" /> Add a pack
        </button>
      </Card>

      <Card title="Cost and stock (only you see this)">
        <div className="grid grid-cols-2 gap-4">
          <Labeled label="Cost price (GH₵)" htmlFor={`${ids}-cost`} hint={costPerUnitValue ? `= ${formatMoney(costPerUnitValue)} per ${unit}` : "What you pay the supplier."}>
            <input id={`${ids}-cost`} className={input} type="number" inputMode="decimal" step="0.0001" min="0" value={costInput} onChange={(e) => setCostInput(e.target.value)} />
          </Labeled>
          <Labeled label="Cost is for" htmlFor={`${ids}-costper`}>
            <select id={`${ids}-costper`} className={input} value={costPer} onChange={(e) => setCostPer(Number(e.target.value))}>
              <option value={1}>1 {unit}</option>
              {form.packs
                .filter((p) => p.name && p.units_per_pack > 1)
                .map((p) => (
                  <option key={p.id ?? p.name} value={p.units_per_pack}>
                    1 {p.name} ({p.units_per_pack})
                  </option>
                ))}
            </select>
          </Labeled>
          <Labeled label={`Low stock alert at (${unit}s)`} htmlFor={`${ids}-rl`} hint="0 = use the shop default.">
            <input id={`${ids}-rl`} className={input} type="number" inputMode="numeric" min="0" value={form.reorder_level} onChange={(e) => set("reorder_level", Number(e.target.value) || 0)} />
          </Labeled>
        </div>

        {isNew ? (
          <div className="space-y-2">
            <p className="font-semibold">Stock you have now</p>
            <div className="grid grid-cols-2 gap-4">
              {firstPack && (
                <Labeled label={`${firstPack.name}s`} htmlFor={`${ids}-op`}>
                  <input id={`${ids}-op`} className={input} type="number" inputMode="numeric" min="0" value={openingPacks || ""} onChange={(e) => setOpeningPacks(Number(e.target.value) || 0)} />
                </Labeled>
              )}
              <Labeled label={firstPack ? `Loose ${unit}s` : `${unit}s`} htmlFor={`${ids}-ol`}>
                <input id={`${ids}-ol`} className={input} type="number" inputMode="numeric" min="0" value={openingLoose || ""} onChange={(e) => setOpeningLoose(Number(e.target.value) || 0)} />
              </Labeled>
            </div>
            {openingUnits > 0 && (
              <p className="text-sm text-muted">
                = {openingUnits} {unit}s ({formatStock(openingUnits, unit, firstPack ? [firstPack] : [])})
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-control bg-bg p-3 text-sm text-muted">
            Stock: <strong className="text-ink">{formatStock(product.stock_units, product.base_unit_name, product.packs)}</strong>. To change stock,
            use a stock count or Damaged / expired.
          </p>
        )}
      </Card>

      <Card title="Options">
        <Check label="Show as a quick sell button on the Sell screen" checked={form.is_quick_sell} onChange={(v) => set("is_quick_sell", v)} />
        {!isNew && <Check label="Product can be sold (untick to hide it)" checked={form.is_active} onChange={(v) => set("is_active", v)} />}
      </Card>

      <FormAlert error={error} />
      <button
        type="submit"
        disabled={saving || uploading}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-control bg-brand text-lg font-bold text-white hover:bg-brand-dark disabled:opacity-70"
      >
        {saving && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
        {saving ? "Saving…" : isNew ? "Save product" : "Save changes"}
      </button>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-card border border-line bg-card p-4">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Labeled({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-3 font-semibold">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-brand" />
      {label}
    </label>
  );
}

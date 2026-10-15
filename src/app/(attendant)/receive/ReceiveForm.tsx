"use client";

import { Camera, CheckCircle2, LoaderCircle, Minus, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { ProductPicker } from "@/components/ProductPicker";
import { FormAlert } from "@/components/ui/form";
import type { Product } from "@/lib/catalogue";
import { compressImage, extensionFor } from "@/lib/image";
import type { SellOptionView } from "@/lib/sell-options";
import { createClient } from "@/lib/supabase/client";
import { addSupplier, recordDelivery } from "./actions";

type Supplier = { id: string; name: string };
type Line = { option: SellOptionView; qty: number; cost: string };

type Props = {
  products: Product[];
  suppliers: Supplier[];
  userId: string;
  isOwner: boolean;
};

const input = "h-12 w-full rounded-control border border-input bg-card px-3 text-base";

export function ReceiveForm({ products, suppliers: initialSuppliers, userId, isOwner }: Props) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [supplierId, setSupplierId] = useState("");
  const [newSupplier, setNewSupplier] = useState<{ name: string; phone: string } | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [saving, startSaving] = useTransition();
  const [clientRef, setClientRef] = useState(() => crypto.randomUUID());

  const add = (option: SellOptionView) =>
    setLines((ls) =>
      ls.some((l) => l.option.key === option.key)
        ? ls.map((l) => (l.option.key === option.key ? { ...l, qty: l.qty + 1 } : l))
        : [...ls, { option, qty: 1, cost: "" }],
    );
  const update = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.option.key === key ? { ...l, ...patch } : l)).filter((l) => l.qty > 0));

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(undefined);
    try {
      const blob = await compressImage(file, 1400);
      const path = `${userId}/${crypto.randomUUID()}.${extensionFor(blob)}`;
      const { error: uploadError } = await createClient().storage.from("invoices").upload(path, blob, { contentType: blob.type });
      if (uploadError) throw uploadError;
      setPhotoPath(path);
      setPhotoPreview(URL.createObjectURL(blob));
    } catch {
      setError("Could not upload the photo. Check your internet and try again.");
    } finally {
      setUploading(false);
    }
  }

  function save() {
    setError(undefined);
    if (lines.length === 0) return setError("Add the items that were delivered.");
    startSaving(async () => {
      let sid: string | null = supplierId || null;
      if (newSupplier) {
        const s = await addSupplier(newSupplier.name, newSupplier.phone);
        if (!s.ok) return setError(s.error);
        setSuppliers((list) => [...list, { id: s.id, name: s.name }]);
        setSupplierId(s.id);
        setNewSupplier(null);
        sid = s.id;
      }
      const result = await recordDelivery({
        supplierId: sid,
        items: lines.map((l) => ({
          product_id: l.option.product.id,
          pack_id: l.option.packId,
          qty: l.qty,
          // Owner types cost per pack/unit as delivered; store per base unit.
          cost_per_unit: isOwner && l.cost.trim() !== "" ? Number(l.cost) / l.option.unitsPerPack : null,
        })),
        photoPath,
        note,
        clientRef,
      });
      if (!result.ok) return setError(result.error);
      setDone(result.status === "confirmed" ? "Delivery saved and confirmed." : "Delivery saved. Stock is updated. The owner will check it.");
      setLines([]);
      setNote("");
      setPhotoPath(null);
      setPhotoPreview(null);
      setClientRef(crypto.randomUUID());
    });
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-card bg-success-bg p-6 text-center">
        <CheckCircle2 aria-hidden="true" className="mx-auto size-12 text-brand" />
        <p className="text-lg font-bold text-brand">{done}</p>
        <button type="button" onClick={() => setDone(undefined)} className="h-12 rounded-control bg-brand px-5 font-semibold text-white">
          Receive another delivery
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-card border border-line bg-card p-4">
        <h2 className="font-bold">Supplier</h2>
        {newSupplier ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={input} placeholder="Supplier name" value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} aria-label="Supplier name" />
            <input className={input} placeholder="Phone (optional)" type="tel" value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} aria-label="Supplier phone" />
            <button type="button" onClick={() => setNewSupplier(null)} className="min-h-11 text-left text-sm font-semibold text-brand">
              Pick an existing supplier instead
            </button>
          </div>
        ) : (
          <>
            <select className={input} value={supplierId} onChange={(e) => setSupplierId(e.target.value)} aria-label="Supplier">
              <option value="">Not sure / no supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setNewSupplier({ name: "", phone: "" })} className="min-h-11 text-sm font-semibold text-brand">
              + New supplier
            </button>
          </>
        )}
      </div>

      <div className="space-y-3 rounded-card border border-line bg-card p-4">
        <h2 className="font-bold">Invoice photo</h2>
        {photoPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoPreview} alt="Invoice" className="max-h-64 rounded-control object-contain" />
        )}
        <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-control border border-input font-semibold">
          {uploading ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <Camera aria-hidden="true" className="size-5" />}
          {photoPath ? "Retake photo" : "Take photo of invoice"}
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={uploading} onChange={(e) => onPhoto(e.target.files?.[0])} />
        </label>
      </div>

      <div className="space-y-3 rounded-card border border-line bg-card p-4">
        <h2 className="font-bold">Items delivered</h2>
        <ProductPicker products={products} onPick={add} />
        {lines.length > 0 && (
          <ul className="divide-y divide-line">
            {lines.map((l) => (
              <li key={l.option.key} className="space-y-2 py-3">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{l.option.product.name}</span>
                    <span className="block text-sm text-muted">
                      {l.option.label}
                      {l.option.unitsPerPack > 1 && ` of ${l.option.unitsPerPack}`} · {l.qty * l.option.unitsPerPack} {l.option.product.base_unit_name}s
                    </span>
                  </span>
                  <button type="button" aria-label="One less" onClick={() => update(l.option.key, { qty: l.qty - 1 })} className="flex size-11 items-center justify-center rounded-full border border-input">
                    <Minus aria-hidden="true" className="size-4" />
                  </button>
                  <input
                    aria-label={`Quantity of ${l.option.product.name}`}
                    inputMode="numeric"
                    value={l.qty}
                    onChange={(e) => update(l.option.key, { qty: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                    className="h-11 w-16 rounded-control border border-input text-center text-base font-bold"
                  />
                  <button type="button" aria-label="One more" onClick={() => update(l.option.key, { qty: l.qty + 1 })} className="flex size-11 items-center justify-center rounded-full border border-input">
                    <Plus aria-hidden="true" className="size-4" />
                  </button>
                  <button type="button" aria-label="Remove" onClick={() => update(l.option.key, { qty: 0 })} className="flex size-11 items-center justify-center text-danger">
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
                {isOwner && (
                  <label className="flex items-center gap-2 text-sm">
                    <span className="shrink-0 text-muted">Cost per {l.option.label} (GH₵)</span>
                    <input className="h-11 w-28 rounded-control border border-input px-2 text-base" type="number" inputMode="decimal" step="0.01" min="0" value={l.cost} onChange={(e) => update(l.option.key, { cost: e.target.value })} />
                  </label>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="block space-y-1">
        <span className="font-semibold">Note (optional)</span>
        <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2 cartons damaged" />
      </label>

      {!isOwner && <p className="rounded-control bg-info-bg p-3 text-info">Stock goes up as soon as you save. Prince confirms the delivery on his next visit.</p>}

      <FormAlert error={error} />
      <button type="button" onClick={save} disabled={saving || uploading} className="flex h-[58px] w-full items-center justify-center gap-2 rounded-control bg-accent text-lg font-bold text-ink disabled:opacity-60">
        {saving && <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />}
        Save delivery
      </button>
    </div>
  );
}

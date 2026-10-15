"use client";

import { ImageOff, Minus, Plus, ScanLine, Search, Trash2, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import type { Category, Product } from "@/lib/catalogue";
import { formatMoney } from "@/lib/money";
import { toPesewas, type PriceMode } from "@/lib/pricing";
import type { Receipt, ShopInfo } from "@/lib/receipt";
import { formatStock } from "@/lib/stock";
import { PaymentPanel } from "./PaymentPanel";
import { ReceiptView } from "./ReceiptView";
import { optionsFor, priceOf, type CartLine, type SellCustomer, type SellOptionView } from "./sell-types";

type Props = {
  products: Product[];
  categories: Category[];
  customers: SellCustomer[];
  shop: ShopInfo;
  isOwner: boolean;
};

export function SellScreen({ products, categories, customers, shop, isOwner }: Props) {
  const [mode, setMode] = useState<PriceMode>("retail");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [step, setStep] = useState<"cart" | "payment" | "receipt">("cart");
  const [receipt, setReceipt] = useState<Receipt>();
  const searchRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => products.flatMap(optionsFor), [products]);
  const optionByKey = useMemo(() => new Map(options.map((o) => [o.key, o])), [options]);
  const byBarcode = useMemo(() => {
    const map = new Map<string, SellOptionView>();
    for (const p of products) {
      if (p.barcode) map.set(p.barcode, optionByKey.get(`${p.id}:unit`)!);
      for (const pack of p.packs) if (pack.barcode && pack.is_active) map.set(pack.barcode, optionByKey.get(`${p.id}:${pack.id}`)!);
    }
    return map;
  }, [products, optionByKey]);

  const lines = cart
    .map((line) => ({ ...line, option: optionByKey.get(line.key) }))
    .filter((l): l is CartLine & { option: SellOptionView } => Boolean(l.option));
  const totalPesewas = lines.reduce((sum, l) => sum + toPesewas(priceOf(l.option, mode, l.qty)) * l.qty, 0);

  /** Base units of a product already in the cart (all its options together). */
  const unitsInCart = useCallback(
    (productId: string, except?: string) =>
      cart.reduce((sum, l) => {
        const o = optionByKey.get(l.key);
        return o && o.product.id === productId && l.key !== except ? sum + o.unitsPerPack * l.qty : sum;
      }, 0),
    [cart, optionByKey],
  );

  const setQty = (key: string, qty: number) => {
    const option = optionByKey.get(key);
    if (!option) return;
    const available = option.product.stock_units - unitsInCart(option.product.id, key);
    const max = Math.floor(available / option.unitsPerPack);
    if (qty > max) {
      setNotice(`Only ${formatStock(option.product.stock_units, option.product.base_unit_name, option.product.packs)} of ${option.product.name} in stock.`);
      qty = max;
    }
    setCart((c) => (qty <= 0 ? c.filter((l) => l.key !== key) : c.some((l) => l.key === key) ? c.map((l) => (l.key === key ? { ...l, qty } : l)) : [...c, { key, qty }]));
  };

  const add = (option: SellOptionView) => {
    setNotice(undefined);
    const current = cart.find((l) => l.key === option.key)?.qty ?? 0;
    setQty(option.key, current + 1);
  };

  const onBarcode = (code: string) => {
    const option = byBarcode.get(code.trim());
    if (option) {
      add(option);
      setNotice(`Added ${option.product.name}${option.packId ? ` (${option.label})` : ""}.`);
      return true;
    }
    setNotice(`No product with barcode ${code}.`);
    return false;
  };

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.brand ?? "").toLowerCase().includes(q) || p.barcode === q)
      .slice(0, 20);
  }, [products, q]);
  const quickSell = options.filter((o) => o.quickSell && o.product.stock_units >= o.unitsPerPack);
  const tiles = categoryId === "all" ? products : products.filter((p) => p.category_id === categoryId);

  const newSale = () => {
    setCart([]);
    setReceipt(undefined);
    setStep("cart");
    setMode("retail");
    setNotice(undefined);
    setQuery("");
  };

  if (step === "receipt" && receipt) {
    return <ReceiptView receipt={receipt} shop={shop} onNewSale={newSale} />;
  }

  if (step === "payment") {
    return (
      <PaymentPanel
        lines={lines}
        mode={mode}
        totalPesewas={totalPesewas}
        customers={customers}
        isOwner={isOwner}
        onBack={() => setStep("cart")}
        onDone={(r) => {
          setReceipt(r);
          setStep("receipt");
        }}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_360px]">
      {scanning && (
        <BarcodeScanner
          onClose={() => setScanning(false)}
          onDetected={(code) => {
            if (onBarcode(code)) setScanning(false);
          }}
        />
      )}

      <section aria-label="Products" className="min-w-0 space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            // USB/Bluetooth scanners type the barcode and press Enter.
            e.preventDefault();
            if (query.trim() && onBarcode(query)) setQuery("");
            else if (results.length === 1) {
              add(optionByKey.get(`${results[0].id}:unit`)!);
              setQuery("");
            }
          }}
        >
          <label className="relative flex-1">
            <span className="sr-only">Search or scan a product</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or scan a product"
              autoComplete="off"
              className="h-12 w-full rounded-control border border-input bg-card pr-3 pl-10 text-base"
            />
          </label>
          <button type="button" onClick={() => setScanning(true)} className="flex h-12 items-center gap-2 rounded-control bg-brand px-4 font-semibold text-white">
            <ScanLine aria-hidden="true" className="size-5" />
            Scan
          </button>
        </form>

        <div role="group" aria-label="Price type" className="grid grid-cols-2 rounded-control border border-input bg-card p-1">
          {(["retail", "wholesale"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`h-11 rounded-[10px] font-semibold capitalize ${mode === m ? "bg-brand text-white" : "text-muted"}`}
            >
              {m}
            </button>
          ))}
        </div>

        {notice && (
          <p role="status" className="flex items-center justify-between gap-2 rounded-control bg-info-bg px-3 py-2 text-info">
            {notice}
            <button type="button" aria-label="Dismiss" onClick={() => setNotice(undefined)} className="flex size-8 items-center justify-center">
              <X aria-hidden="true" className="size-4" />
            </button>
          </p>
        )}

        {q ? (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
            {results.length === 0 && <li className="p-4 text-muted">No products match &quot;{query}&quot;.</li>}
            {results.map((p) => (
              <li key={p.id} className="space-y-2 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{p.name}</span>
                  <span className={`text-sm ${p.stock_units > 0 ? "text-muted" : "font-semibold text-danger"}`}>
                    {p.stock_units > 0 ? formatStock(p.stock_units, p.base_unit_name, p.packs) : "Out of stock"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {optionsFor(p).map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      disabled={p.stock_units < o.unitsPerPack}
                      onClick={() => add(o)}
                      className="flex h-11 items-center gap-1.5 rounded-control border border-input bg-card px-3 text-sm font-semibold hover:border-brand disabled:opacity-40"
                    >
                      <Plus aria-hidden="true" className="size-4 text-brand" />
                      {o.label} · {formatMoney(priceOf(o, mode, 1))}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <>
            {quickSell.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-bold tracking-wide text-muted uppercase">Quick sell</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {quickSell.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => add(o)}
                      className="flex min-h-16 flex-col items-start justify-center rounded-control border border-line bg-card px-3 py-2 text-left hover:border-brand"
                    >
                      <span className="line-clamp-2 text-sm leading-tight font-semibold">
                        {o.product.name}
                        {o.packId && ` (${o.label})`}
                      </span>
                      <span className="font-bold text-brand">{formatMoney(priceOf(o, mode, 1))}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tablet: browse all products by category. */}
            <div className="hidden space-y-3 md:block">
              <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by category">
                {[{ id: "all", name: "All" }, ...categories.filter((c) => c.is_active)].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={categoryId === c.id}
                    onClick={() => setCategoryId(c.id)}
                    className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap ${categoryId === c.id ? "bg-brand text-white" : "border border-input bg-card"}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
                {tiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={p.stock_units <= 0}
                    onClick={() => add(optionByKey.get(`${p.id}:unit`)!)}
                    className="flex flex-col overflow-hidden rounded-control border border-line bg-card text-left hover:border-brand disabled:opacity-40"
                  >
                    {p.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo_url} alt="" className="h-20 w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-20 items-center justify-center bg-bg text-muted">
                        <ImageOff aria-hidden="true" className="size-5" />
                      </span>
                    )}
                    <span className="p-2">
                      <span className="line-clamp-2 text-sm leading-tight font-semibold">{p.name}</span>
                      <span className="block font-bold text-brand">{formatMoney(priceOf(optionByKey.get(`${p.id}:unit`)!, mode, 1))}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {quickSell.length === 0 && (
              <p className="rounded-card border border-dashed border-input bg-card p-4 text-center text-muted md:hidden">
                Search or scan to add products.
              </p>
            )}
          </>
        )}
      </section>

      <aside aria-label="Current sale" className="space-y-3 rounded-card border border-line bg-card p-4 md:sticky md:top-20 md:self-start">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Current sale</h2>
          {lines.length > 0 && (
            <button type="button" onClick={() => setCart([])} className="flex min-h-11 items-center gap-1 text-sm font-semibold text-danger">
              <Trash2 aria-hidden="true" className="size-4" /> Clear
            </button>
          )}
        </div>
        {lines.length === 0 ? (
          <p className="text-muted">No items yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {lines.map(({ key, qty, option }) => {
              const price = priceOf(option, mode, qty);
              const wholesaleApplied = mode === "wholesale" && price === option.wholesale && option.wholesale !== option.retail;
              return (
                <li key={key} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{option.product.name}</span>
                    <span className="block text-sm text-muted">
                      {option.label} · {formatMoney(price)}
                      {wholesaleApplied && " (wholesale)"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <button type="button" aria-label={`One less ${option.product.name}`} onClick={() => setQty(key, qty - 1)} className="flex size-11 items-center justify-center rounded-full border border-input">
                      <Minus aria-hidden="true" className="size-4" />
                    </button>
                    <input
                      aria-label={`Quantity of ${option.product.name}`}
                      inputMode="numeric"
                      value={qty}
                      onChange={(e) => setQty(key, Number(e.target.value.replace(/\D/g, "")) || 0)}
                      className="h-11 w-12 rounded-control border border-input text-center text-base font-bold"
                    />
                    <button type="button" aria-label={`One more ${option.product.name}`} onClick={() => setQty(key, qty + 1)} className="flex size-11 items-center justify-center rounded-full border border-input">
                      <Plus aria-hidden="true" className="size-4" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {mode === "wholesale" && lines.some((l) => priceOf(l.option, mode, l.qty) !== l.option.wholesale) && (
          <p className="rounded-control bg-warning-bg p-2 text-sm text-warning">
            Some items are below their wholesale quantity, so retail price is charged.
          </p>
        )}

        <button
          type="button"
          disabled={lines.length === 0}
          onClick={() => setStep("payment")}
          className="sticky bottom-24 h-[58px] w-full rounded-control bg-accent text-lg font-bold text-ink shadow-sm disabled:opacity-50 md:static"
        >
          Take payment · {formatMoney(totalPesewas / 100)}
        </button>
      </aside>
    </div>
  );
}

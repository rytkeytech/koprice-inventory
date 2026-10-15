import type { Product } from "@/lib/catalogue";
import { unitPrice, type PriceMode } from "@/lib/pricing";

/** One way to sell a product: the single unit, or one of its packs. */
export type SellOptionView = {
  key: string;
  product: Product;
  packId: string | null;
  label: string;
  unitsPerPack: number;
  retail: number;
  wholesale: number;
  minWholesale: number;
  quickSell: boolean;
};

export type CartLine = { key: string; qty: number };

export type SellCustomer = {
  id: string;
  name: string;
  phone: string | null;
  type: "retail" | "wholesale";
  balance: number;
  credit_limit: number;
};

export function optionsFor(product: Product): SellOptionView[] {
  const base: SellOptionView = {
    key: `${product.id}:unit`,
    product,
    packId: null,
    label: product.base_unit_name,
    unitsPerPack: 1,
    retail: product.retail_price,
    wholesale: product.wholesale_price,
    minWholesale: product.min_wholesale_qty,
    quickSell: product.is_quick_sell,
  };
  const packs = product.packs
    .filter((p) => p.is_active)
    .map((p) => ({
      key: `${product.id}:${p.id}`,
      product,
      packId: p.id,
      label: p.name,
      unitsPerPack: p.units_per_pack,
      retail: p.retail_price,
      wholesale: p.wholesale_price,
      minWholesale: p.min_wholesale_qty,
      quickSell: p.is_quick_sell,
    }));
  return [base, ...packs];
}

export function priceOf(option: SellOptionView, mode: PriceMode, qty: number) {
  return unitPrice(
    {
      retail_price: option.retail,
      wholesale_price: option.wholesale,
      min_wholesale_qty: option.minWholesale,
      units_per_pack: option.unitsPerPack,
    },
    mode,
    qty,
  );
}

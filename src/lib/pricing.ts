// Price rules, mirrored from the complete_sale database function so the screen
// shows the same total the database will charge. The DATABASE decides the real
// price; the client never sends prices.

export type PriceMode = "retail" | "wholesale";

export type SellOption = {
  retail_price: number | string;
  wholesale_price: number | string;
  min_wholesale_qty: number;
  /** 1 for the base unit, e.g. 30 for a bag of 30 sachets. */
  units_per_pack: number;
};

/** Money in pesewas (integer) to avoid floating-point errors when adding. */
export function toPesewas(amount: number | string) {
  return Math.round(Number(amount) * 100);
}

export function fromPesewas(pesewas: number) {
  return pesewas / 100;
}

/** Wholesale price only applies from the minimum wholesale quantity upwards. */
export function unitPrice(option: SellOption, mode: PriceMode, qty: number) {
  const useWholesale = mode === "wholesale" && qty >= option.min_wholesale_qty;
  return Number(useWholesale ? option.wholesale_price : option.retail_price);
}

export function isWholesaleApplied(option: SellOption, mode: PriceMode, qty: number) {
  return mode === "wholesale" && qty >= option.min_wholesale_qty;
}

/** Line total in pesewas. */
export function lineTotalPesewas(option: SellOption, mode: PriceMode, qty: number) {
  return toPesewas(unitPrice(option, mode, qty)) * qty;
}

/** Base units removed from stock, e.g. 2 bags of 30 = 60 sachets. */
export function baseUnits(option: Pick<SellOption, "units_per_pack">, qty: number) {
  return option.units_per_pack * qty;
}

export type PaymentInput = {
  /** Cash handed over by the customer (may be more than needed). */
  cash: number;
  momo: number;
  credit: number;
};

/**
 * Splits a payment the same way complete_sale does.
 * Cash covers whatever MoMo and credit don't; change = extra cash.
 */
export function settle(totalPesewas: number, payment: PaymentInput) {
  const momo = toPesewas(payment.momo);
  const credit = toPesewas(payment.credit);
  const cash = toPesewas(payment.cash);
  const cashNeeded = totalPesewas - momo - credit;
  if (cashNeeded < 0) {
    return { ok: false as const, reason: "MoMo and credit are more than the total." };
  }
  if (cash < cashNeeded) {
    return { ok: false as const, reason: "Not enough money yet.", short: cashNeeded - cash };
  }
  return { ok: true as const, change: cash - cashNeeded, cashNeeded };
}

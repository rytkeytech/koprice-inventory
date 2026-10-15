// Receipt text for WhatsApp (wa.me links). Pure functions, unit-tested.
import { formatDateTime } from "./dates";
import { formatMoney } from "./money";

export type ReceiptItem = {
  name: string;
  pack_name: string | null;
  unit_name: string;
  qty: number;
  unit_price: number | string;
  line_total: number | string;
};

export type Receipt = {
  sale_id: string;
  receipt_no: string;
  created_at: string;
  status: "completed" | "held_for_approval" | "refunded" | "void";
  price_mode: "retail" | "wholesale";
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  paid_cash: number | string;
  paid_momo: number | string;
  momo_txn_id: string | null;
  credit_amount: number | string;
  change_given: number | string;
  note: string | null;
  approval_request_id: string | null;
  attendant_name: string | null;
  customer: { id: string; name: string; phone: string | null; balance: number | string } | null;
  items: ReceiptItem[];
};

export type ShopInfo = {
  shop_name: string;
  phone: string | null;
  location: string | null;
  momo_number: string | null;
  receipt_footer: string | null;
};

/** Ghana numbers for wa.me: "024 123 4567" -> "233241234567". Returns null if not valid. */
export function whatsappNumber(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (/^0\d{9}$/.test(digits)) return `233${digits.slice(1)}`;
  if (/^\+233\d{9}$/.test(digits)) return digits.slice(1);
  if (/^233\d{9}$/.test(digits)) return digits;
  return null;
}

/** wa.me link; without a number WhatsApp lets the user pick a chat. */
export function whatsappLink(text: string, phone?: string | null) {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
}

export function receiptText(receipt: Receipt, shop: ShopInfo) {
  const lines: string[] = [];
  lines.push(`*${shop.shop_name}*`);
  if (shop.location) lines.push(shop.location);
  if (shop.phone) lines.push(`Tel: ${shop.phone}`);
  lines.push("");
  lines.push(`Receipt ${receipt.receipt_no}`);
  lines.push(formatDateTime(receipt.created_at));
  if (receipt.status === "held_for_approval") lines.push("(Waiting for owner approval)");
  lines.push("");
  for (const item of receipt.items) {
    const label = item.pack_name ? `${item.name} (${item.pack_name})` : item.name;
    lines.push(`${item.qty} x ${label} @ ${formatMoney(item.unit_price)} = ${formatMoney(item.line_total)}`);
  }
  lines.push("");
  if (Number(receipt.discount) > 0) {
    lines.push(`Subtotal: ${formatMoney(receipt.subtotal)}`);
    lines.push(`Discount: -${formatMoney(receipt.discount)}`);
  }
  lines.push(`*Total: ${formatMoney(receipt.total)}*`);
  if (Number(receipt.paid_cash) > 0) lines.push(`Cash: ${formatMoney(receipt.paid_cash)}`);
  if (Number(receipt.paid_momo) > 0)
    lines.push(`MoMo: ${formatMoney(receipt.paid_momo)}${receipt.momo_txn_id ? ` (ID ${receipt.momo_txn_id})` : ""}`);
  if (Number(receipt.credit_amount) > 0) lines.push(`On credit: ${formatMoney(receipt.credit_amount)}`);
  if (Number(receipt.change_given) > 0) lines.push(`Change: ${formatMoney(receipt.change_given)}`);
  if (receipt.customer && Number(receipt.credit_amount) > 0) {
    lines.push(`Customer: ${receipt.customer.name}`);
  }
  if (receipt.attendant_name) lines.push(`Served by: ${receipt.attendant_name.split(" ")[0]}`);
  lines.push("");
  lines.push(shop.receipt_footer || "Thank you for shopping with us!");
  return lines.join("\n");
}

/** Friendly WhatsApp reminder to a customer who owes money. */
export function reminderText(name: string, balance: number | string, shop: Pick<ShopInfo, "shop_name" | "momo_number"> & { momo_name?: string | null }) {
  const lines = [
    `Hello ${name.split(" ")[0]}, this is ${shop.shop_name}.`,
    `Your balance with us is ${formatMoney(balance)}.`,
  ];
  if (shop.momo_number) {
    lines.push(`You can pay by MoMo to ${shop.momo_number}${shop.momo_name ? ` (${shop.momo_name})` : ""}.`);
  }
  lines.push("Thank you!");
  return lines.join("\n");
}

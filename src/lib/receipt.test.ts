import { describe, expect, it } from "vitest";
import { receiptText, whatsappLink, whatsappNumber, type Receipt } from "./receipt";

const receipt: Receipt = {
  sale_id: "s1",
  receipt_no: "KP-000123",
  created_at: "2026-10-16T14:05:00Z",
  status: "completed",
  price_mode: "retail",
  subtotal: 61,
  discount: 1,
  total: 60,
  paid_cash: 50,
  paid_momo: 20,
  momo_txn_id: "TX9",
  credit_amount: 0,
  change_given: 10,
  note: null,
  approval_request_id: null,
  attendant_name: "Ama Mensah",
  customer: null,
  items: [
    { name: "Sachet water", pack_name: "Bag", unit_name: "Bag", qty: 2, unit_price: 8, line_total: 16 },
    { name: "Milo", pack_name: null, unit_name: "tin", qty: 1, unit_price: 45, line_total: 45 },
  ],
};

const shop = { shop_name: "Koprice Enterprise", phone: "0240000000", location: "Esreso", momo_number: null, receipt_footer: null };

describe("whatsappNumber", () => {
  it("converts Ghana numbers to international format", () => {
    expect(whatsappNumber("024 123 4567")).toBe("233241234567");
    expect(whatsappNumber("+233 24 123 4567")).toBe("233241234567");
    expect(whatsappNumber("233241234567")).toBe("233241234567");
  });
  it("returns null for invalid numbers", () => {
    expect(whatsappNumber("12345")).toBeNull();
    expect(whatsappNumber("")).toBeNull();
  });
});

describe("receiptText", () => {
  it("lists items, totals, payments and change", () => {
    const text = receiptText(receipt, shop);
    expect(text).toContain("*Koprice Enterprise*");
    expect(text).toContain("Receipt KP-000123");
    expect(text).toContain("2 x Sachet water (Bag) @ GH₵ 8.00 = GH₵ 16.00");
    expect(text).toContain("Discount: -GH₵ 1.00");
    expect(text).toContain("*Total: GH₵ 60.00*");
    expect(text).toContain("MoMo: GH₵ 20.00 (ID TX9)");
    expect(text).toContain("Change: GH₵ 10.00");
    expect(text).toContain("Served by: Ama");
    expect(text).toContain("Thank you for shopping with us!");
  });
});

describe("whatsappLink", () => {
  it("encodes the text and adds the number", () => {
    expect(whatsappLink("Hi there", "0241234567")).toBe("https://wa.me/233241234567?text=Hi%20there");
    expect(whatsappLink("Hi")).toBe("https://wa.me/?text=Hi");
  });
});

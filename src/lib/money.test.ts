import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats with GH₵ and two decimals", () => {
    expect(formatMoney(0)).toBe("GH₵ 0.00");
    expect(formatMoney(5)).toBe("GH₵ 5.00");
    expect(formatMoney(1234.5)).toBe("GH₵ 1,234.50");
  });

  it("accepts numeric strings from Postgres", () => {
    expect(formatMoney("12.30")).toBe("GH₵ 12.30");
  });

  it("puts the minus sign before the currency", () => {
    expect(formatMoney(-3.2)).toBe("-GH₵ 3.20");
  });

  it("treats empty or invalid values as zero", () => {
    expect(formatMoney(null)).toBe("GH₵ 0.00");
    expect(formatMoney(undefined)).toBe("GH₵ 0.00");
    expect(formatMoney("abc")).toBe("GH₵ 0.00");
  });
});

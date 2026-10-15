import { describe, expect, it } from "vitest";
import {
  checkEmail,
  checkFullName,
  checkPassword,
  checkPhone,
  normalisePhone,
  safeNextPath,
} from "./validation";

describe("checkEmail", () => {
  it("accepts a normal address", () => {
    expect(checkEmail("ama@example.com")).toBeNull();
  });
  it("rejects empty and malformed addresses", () => {
    expect(checkEmail("")).toMatch(/Enter your email/);
    expect(checkEmail("ama@")).toMatch(/doesn't look right/);
  });
});

describe("checkPassword", () => {
  it("needs at least 8 characters", () => {
    expect(checkPassword("1234567")).toMatch(/at least 8/);
    expect(checkPassword("12345678")).toBeNull();
  });
});

describe("checkFullName", () => {
  it("needs at least 2 characters", () => {
    expect(checkFullName(" A ")).toMatch(/full name/);
    expect(checkFullName("Ama Mensah")).toBeNull();
  });
});

describe("checkPhone", () => {
  it("accepts Ghana numbers with or without spaces", () => {
    expect(checkPhone("0241234567")).toBeNull();
    expect(checkPhone("024 123 4567")).toBeNull();
    expect(checkPhone("+233241234567")).toBeNull();
  });
  it("rejects short or foreign numbers", () => {
    expect(checkPhone("024123")).toMatch(/valid phone/);
    expect(checkPhone("+44 7700 900123")).toMatch(/valid phone/);
    expect(checkPhone("")).toMatch(/Enter your phone/);
  });
  it("normalises spaces and dashes away", () => {
    expect(normalisePhone("024-123 4567")).toBe("0241234567");
  });
});

describe("safeNextPath", () => {
  it("allows paths inside the app", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
  });
  it("blocks other sites and empty values", () => {
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});

import { describe, expect, it } from "vitest";
import { addDays, daysBetween, percentChange, periodFor } from "./periods";

describe("periodFor", () => {
  it("today compares with yesterday", () => {
    expect(periodFor("today", "2026-10-16")).toMatchObject({ from: "2026-10-16", to: "2026-10-16", prevFrom: "2026-10-15", prevTo: "2026-10-15" });
  });

  it("this week starts on Monday and compares with the same days last week", () => {
    // 16 Oct 2026 is a Friday.
    expect(periodFor("week", "2026-10-16")).toMatchObject({ from: "2026-10-12", to: "2026-10-16", prevFrom: "2026-10-05", prevTo: "2026-10-09" });
    // A Monday is a one-day week.
    expect(periodFor("week", "2026-10-12")).toMatchObject({ from: "2026-10-12", prevFrom: "2026-10-05", prevTo: "2026-10-05" });
  });

  it("this month compares with the same days last month", () => {
    expect(periodFor("month", "2026-10-16")).toMatchObject({ from: "2026-10-01", to: "2026-10-16", prevFrom: "2026-09-01", prevTo: "2026-09-16" });
  });

  it("does not run past the end of a shorter month", () => {
    expect(periodFor("month", "2026-03-31")).toMatchObject({ prevFrom: "2026-02-01", prevTo: "2026-02-28" });
  });
});

describe("date helpers", () => {
  it("adds days across months and counts days inclusively", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(daysBetween("2026-10-01", "2026-10-16")).toBe(16);
  });

  it("percent change", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeNull();
  });
});

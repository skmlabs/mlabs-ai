import { describe, it, expect } from "vitest";
import { getDateRange, eachDay, toYMD, normalizeRangeKey } from "@/lib/dateRange";

describe("dateRange", () => {
  it("7d spans 7 days inclusive", () => {
    const { start, end } = getDateRange("7d");
    expect(eachDay(start, end).length).toBe(7);
  });
  it("28d spans 28 days", () => {
    const { start, end } = getDateRange("28d");
    expect(eachDay(start, end).length).toBe(28);
  });
  it("90d spans 90 days", () => {
    const { start, end } = getDateRange("90d");
    expect(eachDay(start, end).length).toBe(90);
  });
  it("end is yesterday (not today)", () => {
    const { end } = getDateRange("7d");
    const today = new Date();
    today.setUTCHours(0,0,0,0);
    expect(end.getTime()).toBeLessThan(today.getTime());
  });
  it("toYMD returns ISO date slice", () => {
    const d = new Date(Date.UTC(2026, 0, 15));
    expect(toYMD(d)).toBe("2026-01-15");
  });
  it("normalizeRangeKey falls back to 7d for unknown values", () => {
    expect(normalizeRangeKey("yesterday")).toBe("7d");
    expect(normalizeRangeKey(null)).toBe("7d");
    expect(normalizeRangeKey("")).toBe("7d");
    expect(normalizeRangeKey("bogus")).toBe("7d");
  });
  it("normalizeRangeKey keeps valid keys", () => {
    expect(normalizeRangeKey("7d")).toBe("7d");
    expect(normalizeRangeKey("28d")).toBe("28d");
    expect(normalizeRangeKey("90d")).toBe("90d");
    expect(normalizeRangeKey("custom")).toBe("custom");
  });
});

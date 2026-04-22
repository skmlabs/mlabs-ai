import { describe, it, expect } from "vitest";
import { getDateRange, eachDay, toYMD } from "@/lib/dateRange";

describe("dateRange", () => {
  it("yesterday returns a single day", () => {
    const { start, end } = getDateRange("yesterday");
    expect(toYMD(start)).toBe(toYMD(end));
  });
  it("7d spans 7 days inclusive", () => {
    const { start, end } = getDateRange("7d");
    expect(eachDay(start, end).length).toBe(7);
  });
  it("28d spans 28 days", () => {
    const { start, end } = getDateRange("28d");
    expect(eachDay(start, end).length).toBe(28);
  });
  it("end is yesterday (not today)", () => {
    const { end } = getDateRange("7d");
    const today = new Date();
    today.setUTCHours(0,0,0,0);
    expect(end.getTime()).toBeLessThan(today.getTime());
  });
});

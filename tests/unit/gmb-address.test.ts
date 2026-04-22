import { describe, it, expect } from "vitest";
import { formatAddress } from "@/lib/gmb/client";

describe("formatAddress", () => {
  it("formats full address", () => {
    const a = { addressLines: ["123 Main St"], locality: "Delhi", administrativeArea: "DL", postalCode: "110001", regionCode: "IN" };
    expect(formatAddress(a)).toBe("123 Main St, Delhi, DL, 110001, IN");
  });
  it("returns null for empty", () => {
    expect(formatAddress(undefined)).toBeNull();
    expect(formatAddress({})).toBeNull();
  });
});

import { describe, it, expect } from "vitest";

function validPlaceId(s: string): boolean {
  return /^[A-Za-z0-9_-]{20,}$/.test(s);
}

describe("place id validation", () => {
  it("accepts valid Google place IDs", () => {
    expect(validPlaceId("ChIJRWIs4lDjDDkRh74lAOByp38")).toBe(true);
    expect(validPlaceId("ChIJN1t_tDeuEmsRUsoyG83frY4")).toBe(true);
    expect(validPlaceId("GhIJQWDl0CIeQUARxks3icF8U8A")).toBe(true);
  });
  it("rejects too-short strings", () => {
    expect(validPlaceId("abc")).toBe(false);
    expect(validPlaceId("")).toBe(false);
  });
  it("rejects strings with invalid characters", () => {
    expect(validPlaceId("ChIJ with spaces invalid")).toBe(false);
    expect(validPlaceId("https://example.com/path")).toBe(false);
  });
});

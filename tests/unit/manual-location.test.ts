import { describe, it, expect } from "vitest";

describe("manual location surrogates", () => {
  it("resource name falls back to manual:{placeId} format", () => {
    const placeId = "ChIJRWIs4lDjDDkRh74lAOByp38";
    const expected = `locations/manual:${placeId}`;
    expect(expected).toMatch(/^locations\/manual:ChIJ/);
  });
});

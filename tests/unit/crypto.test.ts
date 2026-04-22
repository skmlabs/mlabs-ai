import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";
import { randomBytes } from "crypto";

beforeAll(() => {
  // Set a deterministic test key (32 bytes, base64-encoded) if not already set
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  }
});

describe("crypto", () => {
  it("encrypts and decrypts a string round-trip", () => {
    const pt = "ya29.a0Aa7MYipFakeAccessToken12345";
    const ct = encrypt(pt);
    expect(ct).not.toContain(pt);
    expect(decrypt(ct)).toBe(pt);
  });

  it("encrypts same plaintext to different ciphertexts (IV randomness)", () => {
    const pt = "hello world";
    const c1 = encrypt(pt);
    const c2 = encrypt(pt);
    expect(c1).not.toBe(c2);
    expect(decrypt(c1)).toBe(pt);
    expect(decrypt(c2)).toBe(pt);
  });

  it("rejects tampered ciphertext (auth tag)", () => {
    const ct = encrypt("secret");
    const parts = ct.split(".");
    // flip a byte in the ciphertext portion
    const tampered = Buffer.from(parts[2]!, "base64");
    tampered[0] = (tampered[0]! ^ 0xff) & 0xff;
    parts[2] = tampered.toString("base64");
    expect(() => decrypt(parts.join("."))).toThrow();
  });

  it("rejects malformed bundle", () => {
    expect(() => decrypt("garbage")).toThrow();
    expect(() => decrypt("only.two")).toThrow();
  });
});

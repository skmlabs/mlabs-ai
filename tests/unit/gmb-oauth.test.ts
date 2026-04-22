import { describe, it, expect, beforeAll } from "vitest";
import { buildGoogleAuthUrl } from "@/lib/gmb/oauth";

beforeAll(() => {
  process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
});

describe("gmb oauth", () => {
  it("builds auth URL with business.manage scope and offline access", () => {
    const url = buildGoogleAuthUrl({ state: "abc", redirectUri: "http://localhost:3000/api/gmb/callback" });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("client_id")).toBe("test-client-id");
    expect(u.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/gmb/callback");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("scope")).toContain("business.manage");
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("state")).toBe("abc");
  });
});

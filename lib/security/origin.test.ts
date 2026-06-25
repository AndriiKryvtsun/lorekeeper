import { describe, expect, it } from "vitest";

import { isSameOrigin } from "@/lib/security/origin";

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/x", { method: "POST", headers });
}

describe("isSameOrigin", () => {
  it("passes when the Origin host matches the forwarded host", () => {
    expect(
      isSameOrigin(
        req({ origin: "https://app.example.com", "x-forwarded-host": "app.example.com" }),
      ),
    ).toBe(true);
  });

  it("rejects a cross-origin request", () => {
    expect(
      isSameOrigin(
        req({ origin: "https://evil.example", "x-forwarded-host": "app.example.com" }),
      ),
    ).toBe(false);
  });

  it("rejects when the Origin header is absent", () => {
    expect(isSameOrigin(req({ "x-forwarded-host": "app.example.com" }))).toBe(false);
  });
});

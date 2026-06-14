import { describe, expect, it } from "vitest";

import { AVATAR_MAX_BYTES, validateAvatar } from "@/lib/validation/avatar";

describe("validateAvatar", () => {
  it("accepts allowed raster types within the size limit", () => {
    expect(validateAvatar({ type: "image/png", size: 1000 })).toEqual({
      ok: true,
      mime: "image/png",
    });
    expect(validateAvatar({ type: "image/jpeg", size: 1000 }).ok).toBe(true);
    expect(validateAvatar({ type: "image/webp", size: 1000 }).ok).toBe(true);
  });

  it("rejects SVG (stored-XSS risk) and other non-raster/non-image types", () => {
    expect(validateAvatar({ type: "image/svg+xml", size: 100 })).toEqual({
      ok: false,
      reason: "type",
    });
    expect(validateAvatar({ type: "text/html", size: 100 }).ok).toBe(false);
    expect(validateAvatar({ type: "application/pdf", size: 100 }).ok).toBe(false);
  });

  it("rejects oversized and empty files", () => {
    expect(validateAvatar({ type: "image/png", size: AVATAR_MAX_BYTES + 1 })).toEqual({
      ok: false,
      reason: "size",
    });
    expect(validateAvatar({ type: "image/png", size: 0 }).ok).toBe(false);
  });
});

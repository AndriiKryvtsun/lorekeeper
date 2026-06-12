import { describe, expect, it, vi } from "vitest";

import {
  NoProviderConfiguredError,
  UnknownProviderError,
} from "@/lib/sdk/core/errors";
import { Registry } from "@/lib/sdk/core/registry";

type Echo = { say: () => string };

function build() {
  return new Registry<Echo>("echo")
    .register("a", { say: () => "a" })
    .register("b", { say: () => "b" });
}

describe("Registry selection", () => {
  it("resolves the active provider from selection config", () => {
    expect(build().resolve({ active: "b" }).say()).toBe("b");
  });

  it("orders active then fallbacks, de-duplicated", () => {
    expect(build().order({ active: "a", fallback: ["b", "a"] })).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("Registry fallback", () => {
  it("falls back to the next provider when the primary throws", async () => {
    const reg = new Registry<Echo>("echo")
      .register("primary", {
        say: () => {
          throw new Error("primary down");
        },
      })
      .register("secondary", { say: () => "ok" });

    const result = await reg.callWithFallback(
      { active: "primary", fallback: ["secondary"] },
      async (adapter) => adapter.say(),
    );
    expect(result).toBe("ok");
  });

  it("rethrows the last error when every provider fails", async () => {
    const reg = new Registry<Echo>("echo")
      .register("p", {
        say: () => {
          throw new Error("p");
        },
      })
      .register("q", {
        say: () => {
          throw new Error("q-last");
        },
      });

    await expect(
      reg.callWithFallback({ active: "p", fallback: ["q"] }, async (a) =>
        a.say(),
      ),
    ).rejects.toThrow("q-last");
  });

  it("does not call fallback when the primary succeeds", async () => {
    const secondary = vi.fn(() => "b");
    const reg = new Registry<Echo>("echo")
      .register("a", { say: () => "a" })
      .register("b", { say: secondary });

    const result = await reg.callWithFallback(
      { active: "a", fallback: ["b"] },
      async (adapter) => adapter.say(),
    );
    expect(result).toBe("a");
    expect(secondary).not.toHaveBeenCalled();
  });
});

describe("Registry errors", () => {
  it("throws UnknownProviderError for an unregistered id", () => {
    expect(() => build().resolve({ active: "zzz" })).toThrow(
      UnknownProviderError,
    );
  });

  it("throws NoProviderConfiguredError when no active provider", () => {
    expect(() =>
      build().resolve({ active: "" } as unknown as { active: string }),
    ).toThrow(NoProviderConfiguredError);
  });
});

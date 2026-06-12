import { describe, expect, it } from "vitest";

import { CircuitBreaker } from "@/lib/sdk/http/circuit-breaker";

describe("CircuitBreaker", () => {
  it("opens after the failure threshold and short-circuits", () => {
    let t = 1000;
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      cooldownMs: 500,
      now: () => t,
    });

    expect(cb.canRequest("p")).toBe(true);
    cb.onFailure("p");
    expect(cb.canRequest("p")).toBe(true); // 1 < threshold
    cb.onFailure("p");
    expect(cb.stateOf("p")).toBe("open");
    expect(cb.canRequest("p")).toBe(false);
  });

  it("goes half-open after cooldown and closes on success", () => {
    let t = 0;
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 500,
      now: () => t,
    });

    cb.onFailure("p");
    expect(cb.stateOf("p")).toBe("open");

    t = 600; // cooldown elapsed
    expect(cb.stateOf("p")).toBe("half-open");
    expect(cb.canRequest("p")).toBe(true);

    cb.onSuccess("p");
    expect(cb.stateOf("p")).toBe("closed");
  });

  it("scopes state per provider id", () => {
    let t = 0;
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      cooldownMs: 500,
      now: () => t,
    });
    cb.onFailure("p");
    expect(cb.canRequest("p")).toBe(false);
    expect(cb.canRequest("q")).toBe(true);
  });
});

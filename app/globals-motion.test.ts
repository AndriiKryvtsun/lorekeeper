import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// The motion layer and its reduced-motion "off" variant live in globals.css. These tests
// assert the contract directly from the stylesheet (no browser needed): every animation has
// a single global reduced-motion fallback, and the motion-layer utilities exist.
const css = readFileSync(
  fileURLToPath(new URL("./globals.css", import.meta.url)),
  "utf8",
);

describe("motion layer", () => {
  it("defines the entrance/transition utilities", () => {
    expect(css).toMatch(/\.lk-animate-rise\b/);
    expect(css).toMatch(/\.lk-animate-fade\b/);
    expect(css).toMatch(/\.lk-animate-scale-in\b/);
    expect(css).toMatch(/\.lk-animate-item\b/);
    expect(css).toMatch(/\.lk-skeleton\b/);
  });

  it("uses only transform/opacity in its keyframes (no layout-shifting properties)", () => {
    const keyframes = css.match(/@keyframes lk-[\w-]+\s*\{[\s\S]*?\n\}/g) ?? [];
    expect(keyframes.length).toBeGreaterThan(0);
    for (const block of keyframes) {
      // Allow transform/opacity; reject width/height/top/left/margin/padding.
      expect(block).not.toMatch(/\b(width|height|top|left|right|bottom|margin|padding)\s*:/);
    }
  });
});

describe("prefers-reduced-motion", () => {
  it("provides a single global reduced-motion guard", () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it("neutralizes animation and transition under reduced motion", () => {
    const block = css.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}\s*\n\}/,
    )?.[0];
    // Fall back to a looser capture if the nested-brace match misses.
    const guard = block ?? css.slice(css.indexOf("prefers-reduced-motion"));
    expect(guard).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(guard).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(guard).toMatch(/animation-delay:\s*0ms\s*!important/);
  });
});

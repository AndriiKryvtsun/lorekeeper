import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// AA-contrast verification for the design tokens, computed directly from globals.css. The
// palette uses OKLCH; we convert OKLCH -> linear sRGB (Björn Ottosson's transform) -> WCAG
// relative luminance -> contrast ratio, for both the light (:root) and dark (.dark) themes,
// including text rendered over the arcane gradient stops.
const css = readFileSync(
  fileURLToPath(new URL("./globals.css", import.meta.url)),
  "utf8",
);

type Oklch = { L: number; C: number; H: number };

function parseBlock(selector: string): Map<string, Oklch> {
  // First occurrence of `<selector> { ... }`, terminated by a newline + closing brace.
  const re = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([\\s\\S]*?)\\n\\}`);
  const body = css.match(re)?.[1] ?? "";
  const tokens = new Map<string, Oklch>();
  const tokenRe = /--([\w-]+):\s*oklch\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(body))) {
    const name = m[1];
    const raw = m[2].split("/")[0].trim(); // drop alpha
    const [L, C, H] = raw.split(/\s+/).map(Number);
    if ([L, C, H].some(Number.isNaN)) continue;
    tokens.set(name, { L, C, H });
  }
  return tokens;
}

function oklchToLinearRgb({ L, C, H }: Oklch): [number, number, number] {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [r, g, bl].map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
}

function luminance(color: Oklch): number {
  const [r, g, b] = oklchToLinearRgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: Oklch, bg: Oklch): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const root = parseBlock(":root");
const dark = parseBlock(".dark");

function resolver(block: Map<string, Oklch>) {
  return (name: string): Oklch => {
    const v = block.get(name) ?? root.get(name);
    if (!v) throw new Error(`missing token --${name}`);
    return v;
  };
}

// [foreground, background, minimum ratio]. Body/label text => 4.5 (AA normal); the focus
// ring is a UI component => 3.0.
const TEXT_PAIRS: Array<[string, string, number]> = [
  ["foreground", "background", 4.5],
  ["card-foreground", "card", 4.5],
  ["popover-foreground", "popover", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["secondary-foreground", "secondary", 4.5],
  ["muted-foreground", "background", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["destructive-foreground", "destructive", 4.5],
  ["ring", "background", 3],
  // Text over the arcane gradient: validate against BOTH stops (worst case).
  ["arcane-foreground", "arcane-from", 4.5],
  ["arcane-foreground", "arcane-to", 4.5],
];

describe.each([
  ["light (:root)", root],
  ["dark (.dark)", dark],
])("AA contrast — %s theme", (_label, block) => {
  const get = resolver(block);
  it.each(TEXT_PAIRS)(
    "%s on %s meets %s:1",
    (fg, bg, min) => {
      const ratio = contrast(get(fg), get(bg));
      expect(ratio).toBeGreaterThanOrEqual(min);
    },
  );
});

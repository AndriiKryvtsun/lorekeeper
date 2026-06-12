import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function walk(dir: string): string[] {
  let out: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", "generated"].includes(entry.name)) continue;
      out = out.concat(walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const norm = (p: string) => p.replaceAll("\\", "/");

// All app source, excluding tests and generated code.
const allFiles = ["lib", "app", "src", "components"]
  .flatMap((r) => walk(join(ROOT, r)))
  .filter((f) => !/\.(test|spec)\.(ts|tsx)$/.test(norm(f)));

describe("vendor/AI-SDK imports are confined to lib/ai", () => {
  // Matches `from "ai"` and `from "@ai-sdk/..."` import statements.
  const VENDOR_IMPORT = /from\s+["'](ai|@ai-sdk\/[^"']+)["']/;

  it("no file outside lib/ai imports a vendor/AI-SDK package", () => {
    const offenders = allFiles.filter((f) => {
      const n = norm(f);
      if (n.includes("/lib/ai/")) return false;
      return VENDOR_IMPORT.test(readFileSync(f, "utf8"));
    });
    expect(offenders.map(norm)).toEqual([]);
  });

  it("the adapters under lib/ai DO import the vendor SDK (sanity check)", () => {
    const adapter = readFileSync(
      join(ROOT, "lib", "ai", "adapters", "anthropic.ts"),
      "utf8",
    );
    expect(VENDOR_IMPORT.test(adapter)).toBe(true);
  });
});

describe("provider API keys are referenced only in lib/ai (+ src/env.ts)", () => {
  for (const key of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) {
    it(`does not reference ${key} outside lib/ai or src/env.ts`, () => {
      const offenders = allFiles.filter((f) => {
        const n = norm(f);
        if (n.includes("/lib/ai/") || n.endsWith("/src/env.ts")) return false;
        return readFileSync(f, "utf8").includes(key);
      });
      expect(offenders.map(norm)).toEqual([]);
    });
  }
});

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

describe("client-safety boundary: core/http are isomorphic", () => {
  const files = [
    ...walk(join(ROOT, "lib", "sdk", "core")),
    ...walk(join(ROOT, "lib", "sdk", "http")),
  ].filter((f) => !/\.(test|spec)\.(ts|tsx)$/.test(f));

  it("scans a non-empty set of core/http files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  // Match actual import statements, not comment mentions.
  const SERVER_ONLY_IMPORT = /import\s+["']server-only["']/;
  const ENV_IMPORT = /from\s+["']~\/env["']/;

  it("never import server-only", () => {
    for (const file of files) {
      expect(SERVER_ONLY_IMPORT.test(readFileSync(file, "utf8"))).toBe(false);
    }
  });

  it("never import ~/env", () => {
    for (const file of files) {
      expect(ENV_IMPORT.test(readFileSync(file, "utf8"))).toBe(false);
    }
  });
});

describe("secret isolation: provider env keys live only in lib/sdk/server", () => {
  // Scan app source, excluding the env definition itself, the SDK server boundary, and tests.
  const files = ["lib", "app", "src", "components"]
    .flatMap((r) => walk(join(ROOT, r)))
    .filter((f) => {
      const n = norm(f);
      return (
        !n.includes("/lib/sdk/server/") &&
        !n.endsWith("/src/env.ts") &&
        !/\.(test|spec)\.(ts|tsx)$/.test(n)
      );
    });

  for (const key of ["PING_PROVIDER", "PING_FALLBACK"]) {
    it(`does not reference ${key} outside lib/sdk/server (or src/env.ts)`, () => {
      const offenders = files.filter((f) =>
        readFileSync(f, "utf8").includes(key),
      );
      expect(offenders.map(norm)).toEqual([]);
    });
  }
});

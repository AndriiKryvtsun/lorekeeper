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
const files = ["lib", "app", "src", "components"]
  .flatMap((r) => walk(join(ROOT, r)))
  .filter((f) => !/\.(test|spec)\.(ts|tsx)$/.test(norm(f)));

describe("service-role admin client is server-only", () => {
  it("the service-role key is referenced only in lib/supabase/admin.ts and src/env.ts", () => {
    const offenders = files.filter((f) => {
      const n = norm(f);
      if (n.endsWith("/lib/supabase/admin.ts") || n.endsWith("/src/env.ts")) return false;
      return readFileSync(f, "utf8").includes("SUPABASE_SERVICE_ROLE_KEY");
    });
    expect(offenders.map(norm)).toEqual([]);
  });

  it("no client component imports the admin client", () => {
    const offenders = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return src.includes('"use client"') && src.includes("lib/supabase/admin");
    });
    expect(offenders.map(norm)).toEqual([]);
  });

  it("admin.ts is marked server-only", () => {
    const src = readFileSync(join(ROOT, "lib", "supabase", "admin.ts"), "utf8");
    expect(src).toContain('import "server-only"');
  });
});

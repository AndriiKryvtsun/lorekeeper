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

// Server env keys that must NEVER appear in client-reachable code (only NEXT_PUBLIC_* may).
const SERVER_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GROQ_API_KEY",
  "CRON_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

// Client-reachable = files marked "use client" anywhere under app/, components/, src/.
const clientFiles = ["app", "components", "src"]
  .flatMap((r) => walk(join(ROOT, r)))
  .filter((f) => !/\.(test|spec)\.(ts|tsx)$/.test(norm(f)))
  .filter((f) => readFileSync(f, "utf8").includes('"use client"'));

describe("no server secret reaches the client", () => {
  it("scans a non-empty set of client components", () => {
    expect(clientFiles.length).toBeGreaterThan(0);
  });

  for (const key of SERVER_KEYS) {
    it(`no client component references ${key}`, () => {
      const offenders = clientFiles.filter((f) => readFileSync(f, "utf8").includes(key));
      expect(offenders.map(norm)).toEqual([]);
    });
  }

  it("client components only read NEXT_PUBLIC_* from process.env", () => {
    const badEnv = /process\.env\.(?!NEXT_PUBLIC_)[A-Z]/;
    const offenders = clientFiles.filter((f) => badEnv.test(readFileSync(f, "utf8")));
    expect(offenders.map(norm)).toEqual([]);
  });
});

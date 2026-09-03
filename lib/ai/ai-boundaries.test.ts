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
  // Matches provider/model SDK imports: `from "ai"`, `@ai-sdk/anthropic`, `@ai-sdk/openai`,
  // `@ai-sdk/groq`. The client UI transport hook `@ai-sdk/react` (useChat) is intentionally
  // NOT matched — it talks to our own route, performs no model-provider call, and is allowed
  // in the client.
  const VENDOR_IMPORT = /from\s+["'](ai|@ai-sdk\/(anthropic|openai|groq))["']/;

  it("no file outside lib/ai imports a provider/model SDK", () => {
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

describe("the action registry's isomorphic half stays client-safe", () => {
  // The chat UI imports the envelope, the action vocabulary, and the payload types from
  // `lib/validation/assistant-actions`, so that module must not reach the server boundary:
  // no `server-only`, and nothing under `lib/data` (which constructs Prisma).
  const CLIENT_SAFE = [
    join("lib", "validation", "assistant-actions.ts"),
    join("lib", "validation", "assistant-proposal.ts"),
  ];

  for (const relative of CLIENT_SAFE) {
    it(`${norm(relative)} imports neither server-only nor lib/data`, () => {
      const source = readFileSync(join(ROOT, relative), "utf8");
      expect(source).not.toMatch(/["']server-only["']/);
      expect(source).not.toMatch(/@\/lib\/data\//);
    });
  }
});

describe("the assistant reaches a write ONLY through the action registry", () => {
  // Every entity write the assistant can perform is bound in lib/data/action-registry.ts. The
  // assistant pipeline and the commit path must therefore never import an entity write function
  // themselves — otherwise a second, unregistered path to a write would exist. (The per-entity
  // tRPC CRUD routers still import them directly: those are the form surfaces, one procedure per
  // entity, not an action/entity dispatch table.)
  const WRITE_FN =
    /\b(create|update|delete)(Npc|Location|Item|Session|Character|Campaign)For(Owner|OwnedCampaign)\b/;

  const assistantPath = allFiles.filter((f) => {
    const n = norm(f);
    if (n.endsWith("/lib/data/action-registry.ts")) return false;
    return n.includes("/lib/ai/") || n.endsWith("/lib/data/proposal.ts");
  });

  it("covers the expected files (sanity check)", () => {
    expect(assistantPath.length).toBeGreaterThan(5);
    expect(assistantPath.map(norm).some((f) => f.endsWith("/lib/data/proposal.ts"))).toBe(
      true,
    );
  });

  it("no assistant-path file names an entity write function", () => {
    const offenders = assistantPath.filter((f) => WRITE_FN.test(readFileSync(f, "utf8")));
    expect(offenders.map(norm)).toEqual([]);
  });

  it("the registry DOES bind entity write functions (sanity check)", () => {
    const registry = readFileSync(
      join(ROOT, "lib", "data", "action-registry.ts"),
      "utf8",
    );
    expect(WRITE_FN.test(registry)).toBe(true);
  });
});

describe("the action registry's isomorphic half stays client-safe", () => {
  for (const key of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY"]) {
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

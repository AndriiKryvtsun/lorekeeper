import "dotenv/config";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in/local only: verifies Supabase RLS denies cross-user rows. Skipped when
// DIRECT_URL is unset (no CI database). Runs entirely inside a rolled-back transaction
// so it leaves no data behind.
const connectionString = process.env.DIRECT_URL;

const OWNER_A = "11111111-1111-1111-1111-111111111111";
const OWNER_B = "22222222-2222-2222-2222-222222222222";
const ID_A = "rls-itest-a";
const ID_B = "rls-itest-b";

let client: pg.Client | null = null;

describe.skipIf(!connectionString)("RLS owner policies", () => {
  beforeAll(async () => {
    client = new pg.Client({ connectionString });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it("hides another user's campaign under the authenticated role", async () => {
    const c = client!;
    try {
      await c.query("BEGIN");
      // Insert two campaigns with distinct owners as the privileged role (bypasses RLS).
      await c.query(
        `INSERT INTO "Campaign" (id, title, system, "ownerId", "createdAt")
         VALUES ($1,'A','sys',$2, now()), ($3,'B','sys',$4, now())`,
        [ID_A, OWNER_A, ID_B, OWNER_B],
      );
      // Make sure the authenticated role can reach the table; RLS still applies.
      await c.query('GRANT USAGE ON SCHEMA public TO authenticated');
      await c.query('GRANT SELECT ON "Campaign" TO authenticated');

      // Act as authenticated user A.
      await c.query("SET LOCAL ROLE authenticated");
      await c.query(
        `SELECT set_config('request.jwt.claims', json_build_object('sub',$1::text)::text, true)`,
        [OWNER_A],
      );

      const res = await c.query(
        `SELECT id FROM "Campaign" WHERE id IN ($1,$2) ORDER BY id`,
        [ID_A, ID_B],
      );
      const ids = res.rows.map((r) => r.id);
      expect(ids).toContain(ID_A);
      expect(ids).not.toContain(ID_B);
    } finally {
      await c.query("ROLLBACK");
    }
  });
});

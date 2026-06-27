// Schema-generation ONLY. `@better-auth/cli generate` can't introspect the
// in-memory adapter the Worker uses when there's no D1 binding, so this config
// swaps in a real SQLite (Kysely + better-sqlite3) adapter. It keeps the same
// withCloudflare options (so the generated tables include better-auth-cloudflare's
// session/geo fields), and SQLite is the same dialect D1 runs — so the emitted SQL
// is what we apply to D1. The Worker itself uses src/auth.ts (native D1).
import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";

export const auth = betterAuth({
  ...withCloudflare(
    { autoDetectIpAddress: true, geolocationTracking: false, cf: {} },
    { emailAndPassword: { enabled: true }, socialProviders: {} },
  ),
  // better-auth auto-detects a better-sqlite3 instance and uses its Kysely dialect.
  database: new Database(":memory:"),
});

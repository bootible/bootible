import type { D1Database, KVNamespace } from "@cloudflare/workers-types";

/** Worker bindings + secrets. OAuth secrets are optional — a provider only turns
 *  on when its id+secret are both present, so the Worker boots with just
 *  email/password + passkeys until the Bootible account's OAuth apps are wired. */
export interface Bindings {
  DATABASE: D1Database;
  KV: KVNamespace;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  TWITCH_CLIENT_ID?: string;
  TWITCH_CLIENT_SECRET?: string;
}

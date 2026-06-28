import type { IncomingRequestCfProperties } from "@cloudflare/workers-types";
import { betterAuth } from "better-auth";
import { bearer, twoFactor } from "better-auth/plugins";
import { withCloudflare } from "better-auth-cloudflare";
import type { Bindings } from "./env";

const pair = (id?: string, secret?: string) =>
  id && secret ? { clientId: id, clientSecret: secret } : undefined;

/** OAuth providers, each enabled only when its id+secret pair is present, so the
 *  Worker boots with just email/password until the Bootible account's OAuth apps
 *  are wired. (Passkeys: add the @better-auth passkey plugin in a follow-up.) */
function socialProviders(env: Bindings) {
  const google = pair(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  const github = pair(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET);
  const discord = pair(env.DISCORD_CLIENT_ID, env.DISCORD_CLIENT_SECRET);
  const twitch = pair(env.TWITCH_CLIENT_ID, env.TWITCH_CLIENT_SECRET);
  return {
    ...(google ? { google } : {}),
    ...(github ? { github } : {}),
    ...(discord ? { discord } : {}),
    ...(twitch ? { twitch } : {}),
  };
}

/**
 * Dual-mode (runtime + `@better-auth/cli generate`). At runtime we pass the
 * native D1 binding (better-auth's Kysely dialect — no Drizzle); with no env
 * (CLI) it falls back to schema-only generation.
 */
export function createAuth(env?: Bindings, cf?: IncomingRequestCfProperties, baseURL?: string) {
  return betterAuth({
    baseURL,
    secret: env?.BETTER_AUTH_SECRET,
    ...withCloudflare(
      {
        autoDetectIpAddress: true,
        geolocationTracking: false,
        cf: cf ?? ({} as IncomingRequestCfProperties),
        d1Native: env?.DATABASE,
        kv: env?.KV,
      },
      {
        emailAndPassword: { enabled: true },
        socialProviders: env ? socialProviders(env) : {},
        // Bearer plugin: the desktop app stores the session token (from the
        // set-auth-token response header) in safeStorage and sends it as
        // Authorization: Bearer — cleaner than cookies for a native client.
        // twoFactor: optional TOTP (authenticator app) second factor.
        plugins: [bearer(), twoFactor()],
        // The desktop social-sign-in redirect target (custom protocol) must be trusted.
        trustedOrigins: ["bootible://"],
      },
    ),
  });
}

/** Consumed by `@better-auth/cli generate` to emit the better-auth tables. */
export const auth = createAuth();

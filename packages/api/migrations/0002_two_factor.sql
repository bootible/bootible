-- two-factor (TOTP) — better-auth twoFactor plugin. Delta on top of 0000.
CREATE TABLE "twoFactor" (
  "id" text NOT NULL PRIMARY KEY,
  "secret" text NOT NULL,
  "backupCodes" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "verified" integer,
  "failedVerificationCount" integer,
  "lockedUntil" date
);
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor" ("secret");
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor" ("userId");

ALTER TABLE "user" ADD COLUMN "twoFactorEnabled" integer;

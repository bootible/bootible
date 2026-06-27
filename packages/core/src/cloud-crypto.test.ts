import { describe, expect, it } from "vitest";
import {
  createKeyMaterial,
  decryptSecrets,
  encryptSecrets,
  type KdfParams,
  rewrapWithPassphrase,
  unlockWithPassphrase,
  unlockWithRecovery,
} from "./cloud-crypto";

// Light KDF so the suite is fast; the scheme is identical, only the cost differs.
const FAST: KdfParams = { memorySize: 1024, iterations: 1, parallelism: 1 };
const secrets = { sunshinePassword: "hunter2", note: "café ☕ unicode" };

describe("cloud-crypto E2E key scheme", () => {
  it("round-trips: create → passphrase unlock → decrypt", async () => {
    const setup = await createKeyMaterial("correct horse battery", FAST);
    const enc = await encryptSecrets(setup.dek, secrets);
    const unlocked = await unlockWithPassphrase(setup.material, "correct horse battery");
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;
    expect(await decryptSecrets(unlocked.value, enc)).toEqual({ ok: true, value: secrets });
  });

  it("recovers via the recovery code (and tolerates messy formatting)", async () => {
    const setup = await createKeyMaterial("pw", FAST);
    const enc = await encryptSecrets(setup.dek, secrets);
    const messy = setup.recoveryCode.toLowerCase().replace(/-/g, " ");
    const r = await unlockWithRecovery(setup.material, messy);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await decryptSecrets(r.value, enc)).toEqual({ ok: true, value: secrets });
  });

  it("rejects a wrong passphrase with a typed failure", async () => {
    const setup = await createKeyMaterial("right", FAST);
    expect(await unlockWithPassphrase(setup.material, "wrong")).toEqual({
      ok: false,
      error: "bad-passphrase",
    });
  });

  it("re-wrap: new passphrase unlocks the same DEK; old fails; recovery still works", async () => {
    const setup = await createKeyMaterial("old", FAST);
    const enc = await encryptSecrets(setup.dek, secrets);
    const m2 = await rewrapWithPassphrase(setup.material, setup.dek, "new", FAST);
    expect((await unlockWithPassphrase(m2, "old")).ok).toBe(false);
    const r = await unlockWithPassphrase(m2, "new");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await decryptSecrets(r.value, enc)).toEqual({ ok: true, value: secrets });
    expect((await unlockWithRecovery(m2, setup.recoveryCode)).ok).toBe(true);
  });

  it("a wrong DEK fails to decrypt secrets (GCM tag rejects, no garbage)", async () => {
    const a = await createKeyMaterial("a", FAST);
    const b = await createKeyMaterial("b", FAST);
    const enc = await encryptSecrets(a.dek, secrets);
    expect(await decryptSecrets(b.dek, enc)).toEqual({ ok: false, error: "decrypt-failed" });
  });

  it("server-visible material leaks neither the DEK, secrets, nor recovery code", async () => {
    const setup = await createKeyMaterial("pw", FAST);
    const enc = await encryptSecrets(setup.dek, secrets);
    const stored = JSON.stringify(setup.material);
    expect(stored).not.toContain(Buffer.from(setup.dek).toString("base64"));
    expect(stored).not.toContain("hunter2");
    expect(stored).not.toContain(setup.recoveryCode);
    expect(stored).not.toContain(setup.recoveryCode.replace(/-/g, ""));
    expect(enc).not.toContain("hunter2");
  });

  it("encrypting the same secrets twice yields different ciphertext (random IV)", async () => {
    const setup = await createKeyMaterial("pw", FAST);
    expect(await encryptSecrets(setup.dek, secrets)).not.toEqual(
      await encryptSecrets(setup.dek, secrets),
    );
  });
});

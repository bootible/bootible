/**
 * End-to-end secret crypto for bootible cloud profile sync.
 *
 * Identity (better-auth) and secret access are separate. This module never emits
 * plaintext key material to anything that would persist it server-side: the
 * server only ever sees the wrapped DEK blobs + salts + KDF params produced here.
 *
 * Scheme (see docs/v2/cloud/design.md):
 *   DEK  = random 256-bit key; AES-256-GCM encrypts profile secrets.
 *   KEK  = Argon2id(secret, salt); wraps the DEK with AES-256-GCM.
 *   The DEK is wrapped twice — by the sync passphrase and by a recovery code —
 *   so either can unlock it, and the server can unwrap neither.
 *
 * Portable: WebCrypto (AES-GCM, CSPRNG) + hash-wasm Argon2id — runs in Node 20+,
 * Electron main, and Cloudflare Workers with no native bindings.
 */
import { argon2id } from "hash-wasm";

export type KdfParams = {
  /** Argon2id memory cost, KiB. */
  memorySize: number;
  iterations: number;
  parallelism: number;
};

/** Desktop defaults (~0.5-1s). Recorded in KeyMaterial so unlock matches setup. */
export const DEFAULT_KDF: KdfParams = { memorySize: 65536, iterations: 3, parallelism: 1 };

/** Everything the server stores. Contains no DEK, KEK, passphrase, or recovery code. */
export interface KeyMaterial {
  kdf: "argon2id";
  params: KdfParams;
  passphraseSalt: string; // base64
  recoverySalt: string; // base64
  wrappedByPassphrase: string; // base64(iv || AES-GCM(KEK_pass, DEK))
  wrappedByRecovery: string; // base64(iv || AES-GCM(KEK_recovery, DEK))
}

export interface KeySetup {
  /** Upload this. Server-safe. */
  material: KeyMaterial;
  /** Cache in the OS keychain on this device. NEVER send anywhere. */
  dek: Uint8Array;
  /** Show once to the user; never stored by us. */
  recoveryCode: string;
}

export type CryptoFail = "bad-passphrase" | "bad-recovery" | "decrypt-failed" | "bad-input";
export type Result<T> = { ok: true; value: T } | { ok: false; error: CryptoFail };

// ── primitives ───────────────────────────────────────────────────────────────

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

// Force an ArrayBuffer-backed copy so WebCrypto's BufferSource type is satisfied
// (TS types Uint8Array as generic over ArrayBufferLike, which excludes SharedArrayBuffer).
function ab(x: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(x);
}

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

// Crockford base32 (no I/L/O/U) for a readable recovery code.
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

/** Normalise a typed recovery code (strip separators, upper-case) before KDF. */
function normaliseRecovery(code: string): string {
  return code.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

async function deriveKek(secret: string, salt: Uint8Array, params: KdfParams): Promise<Uint8Array> {
  return argon2id({
    password: secret,
    salt,
    memorySize: params.memorySize,
    iterations: params.iterations,
    parallelism: params.parallelism,
    hashLength: 32,
    outputType: "binary",
  });
}

async function aesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", ab(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** AES-256-GCM: returns base64(iv(12) || ciphertext+tag). */
async function seal(keyBytes: Uint8Array, plaintext: Uint8Array): Promise<string> {
  const key = await aesKey(keyBytes);
  const iv = randomBytes(12);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: ab(iv) }, key, ab(plaintext)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return toB64(out);
}

/** Inverse of seal. Auth-tag failure → null (caller maps to a typed failure). */
async function open(keyBytes: Uint8Array, blob: string): Promise<Uint8Array | null> {
  try {
    const raw = fromB64(blob);
    if (raw.length < 13) return null;
    const iv = raw.slice(0, 12);
    const ct = raw.slice(12);
    const key = await aesKey(keyBytes);
    return new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv: ab(iv) }, key, ab(ct)),
    );
  } catch {
    return null;
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// ── public API ───────────────────────────────────────────────────────────────

/** First-ever sign-in: mint a DEK, wrap it by passphrase + a fresh recovery code. */
export async function createKeyMaterial(
  passphrase: string,
  params: KdfParams = DEFAULT_KDF,
): Promise<KeySetup> {
  const dek = randomBytes(32);
  const recoveryCode = formatRecovery(base32(randomBytes(16)));
  const passphraseSalt = randomBytes(16);
  const recoverySalt = randomBytes(16);
  const kekP = await deriveKek(passphrase, passphraseSalt, params);
  const kekR = await deriveKek(normaliseRecovery(recoveryCode), recoverySalt, params);
  return {
    dek,
    recoveryCode,
    material: {
      kdf: "argon2id",
      params,
      passphraseSalt: toB64(passphraseSalt),
      recoverySalt: toB64(recoverySalt),
      wrappedByPassphrase: await seal(kekP, dek),
      wrappedByRecovery: await seal(kekR, dek),
    },
  };
}

/** New device: unwrap the DEK with the sync passphrase. */
export async function unlockWithPassphrase(
  m: KeyMaterial,
  passphrase: string,
): Promise<Result<Uint8Array>> {
  const kek = await deriveKek(passphrase, fromB64(m.passphraseSalt), m.params);
  const dek = await open(kek, m.wrappedByPassphrase);
  return dek ? { ok: true, value: dek } : { ok: false, error: "bad-passphrase" };
}

/** Forgot the passphrase: unwrap the DEK with the recovery code. */
export async function unlockWithRecovery(
  m: KeyMaterial,
  recoveryCode: string,
): Promise<Result<Uint8Array>> {
  const kek = await deriveKek(normaliseRecovery(recoveryCode), fromB64(m.recoverySalt), m.params);
  const dek = await open(kek, m.wrappedByRecovery);
  return dek ? { ok: true, value: dek } : { ok: false, error: "bad-recovery" };
}

/** Set a new passphrase for the same DEK (recovery wrap is preserved). */
export async function rewrapWithPassphrase(
  m: KeyMaterial,
  dek: Uint8Array,
  newPassphrase: string,
  params: KdfParams = DEFAULT_KDF,
): Promise<KeyMaterial> {
  const passphraseSalt = randomBytes(16);
  const kekP = await deriveKek(newPassphrase, passphraseSalt, params);
  return {
    ...m,
    params,
    passphraseSalt: toB64(passphraseSalt),
    wrappedByPassphrase: await seal(kekP, dek),
  };
}

/** Encrypt a profile's secrets with the DEK → opaque base64 (random IV each call). */
export async function encryptSecrets(dek: Uint8Array, secrets: unknown): Promise<string> {
  return seal(dek, enc.encode(JSON.stringify(secrets)));
}

/** Decrypt secrets with the DEK. Wrong DEK / tampered blob → typed failure. */
export async function decryptSecrets(
  dek: Uint8Array,
  secretsEnc: string,
): Promise<Result<unknown>> {
  const pt = await open(dek, secretsEnc);
  if (!pt) return { ok: false, error: "decrypt-failed" };
  try {
    return { ok: true, value: JSON.parse(dec.decode(pt)) };
  } catch {
    return { ok: false, error: "decrypt-failed" };
  }
}

/** Group a base32 recovery code into 4-char blocks for display. */
function formatRecovery(raw: string): string {
  return (raw.match(/.{1,4}/g) ?? [raw]).join("-");
}

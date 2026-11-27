import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { HostSshKey } from "@bootible/core";
import { lastBuild } from "./build-state";
import { sshReachable, verifyProbe } from "./verify-probe";

// ── host SSH integration (the key-picker replaces paste-a-key) ───────────────

function sshDir(): string {
  return join(homedir(), ".ssh");
}

/** Fetch a user's public SSH keys from github.com/<user>.keys (the ssh-import-id
 *  endpoint). Username sanitised to GitHub's charset; returns the key lines. */
export async function fetchGithubKeys(user: string): Promise<string[]> {
  const u = (user ?? "").trim().replace(/[^A-Za-z0-9-]/g, "");
  if (!u) return [];
  try {
    const res = await fetch(`https://github.com/${u}.keys`);
    if (!res.ok) return [];
    const text = await res.text();
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^(ssh-|ecdsa-|sk-)/.test(l));
  } catch {
    return [];
  }
}

function readPubKey(dir: string, file: string): HostSshKey | null {
  try {
    const content = readFileSync(join(dir, file), "utf8").trim();
    const parts = content.split(/\s+/);
    if (parts.length < 2) return null; // not a key line
    const type = parts[0] ?? "";
    const comment = parts.slice(2).join(" ");
    return { id: file, label: comment || file, type, publicKey: content };
  } catch {
    return null;
  }
}

/** Enumerate the user's SSH public keys on THIS machine (~/.ssh/*.pub) — the
 *  picker source. Public keys only; private keys are never read. */
export function getHostSshKeys(): HostSshKey[] {
  try {
    const dir = sshDir();
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith(".pub"))
      .map((f) => readPubKey(dir, f))
      .filter((k): k is HostSshKey => k !== null);
  } catch {
    return [];
  }
}

/** Generate a passwordless ed25519 keypair for hands-free SSH, when the user has
 *  none. Returns its public key (added to the picker), or null if ssh-keygen
 *  isn't available. */
export function generateHostSshKey(comment: string): HostSshKey | null {
  try {
    const dir = sshDir();
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "id_ed25519_bootible");
    if (!existsSync(`${path}.pub`)) {
      execFileSync(
        "ssh-keygen",
        ["-t", "ed25519", "-f", path, "-N", "", "-C", comment || "bootible"],
        {
          stdio: "ignore",
        },
      );
    }
    return readPubKey(dir, "id_ed25519_bootible.pub");
  } catch {
    return null;
  }
}

/** Write/replace a delimited bootible-managed Host block in ~/.ssh/config so
 *  `ssh <hostname>` needs no username, password, IP, or key path. Idempotent;
 *  never touches the user's other entries. */
function writeSshAlias(hostname: string, ip: string): void {
  const dir = sshDir();
  mkdirSync(dir, { recursive: true });
  // A reprovisioned device gets a NEW SSH host key at the same name/IP, so a
  // stale known_hosts entry would break `ssh <hostname>` with "HOST
  // IDENTIFICATION HAS CHANGED". Purge any prior entry for this host + IP so the
  // accept-new alias below picks up the new key cleanly.
  for (const h of [hostname, ip]) {
    try {
      execFileSync("ssh-keygen", ["-R", h], { stdio: "ignore" });
    } catch {}
  }
  const configPath = join(dir, "config");
  const begin = `# >>> bootible managed: ${hostname} >>>`;
  const end = `# <<< bootible managed: ${hostname} <<<`;
  // HostName uses the discovered IP (Verify just proved it works); a static IP
  // (G6) makes it permanent. User + key are baked in for prompt-free login.
  const block = [
    begin,
    `Host ${hostname}`,
    `  HostName ${ip}`,
    `  User ${lastBuild.username || "ally"}`,
    ...(lastBuild.identity ? [`  IdentityFile ${lastBuild.identity}`, "  IdentitiesOnly yes"] : []),
    "  StrictHostKeyChecking accept-new",
    end,
  ].join("\n");
  let existing = "";
  try {
    existing = readFileSync(configPath, "utf8");
  } catch {}
  // Drop any prior bootible block for this hostname, then append the fresh one.
  const stripped = existing
    .replace(new RegExp(`${begin}[\\s\\S]*?${end}\\n?`, "g"), "")
    .replace(/\n+$/, "");
  const next = stripped ? `${stripped}\n\n${block}\n` : `${block}\n`;
  writeFileSync(configPath, next, "utf8");
}

/** The private-key path on this machine matching one of the chosen public keys
 *  (so Verify can authenticate), or "" to let ssh use its default identities. */
export function identityForKeys(keys: string[]): string {
  if (keys.length === 0) return "";
  const hostKeys = getHostSshKeys();
  for (const k of keys) {
    const match = hostKeys.find((h) => h.publicKey.trim() === k.trim());
    if (match?.id.endsWith(".pub")) {
      const priv = join(sshDir(), match.id.slice(0, -4));
      if (existsSync(priv)) return priv;
    }
  }
  return "";
}

/** Verify a discovered device over SSH (key auth, no prompts): read its status
 *  + receipt to confirm the configure ran. Returns the raw output, or the error
 *  if unreachable. */
export function verifyDevice(
  ip: string,
  username?: string,
  os: "windows" | "linux" = "windows",
): { reachable: boolean; output: string; alias?: string } {
  const target = `${username || lastBuild.username || "ally"}@${ip}`;
  const remote = verifyProbe(os);
  const args = [
    "-o",
    "BatchMode=yes",
    // bootible re-images devices, so a device's SSH host key changes (and the
    // same IP can be a different device). Don't pin host keys — use a throwaway
    // known_hosts so a changed key never blocks the verify.
    "-o",
    "StrictHostKeyChecking=no",
    "-o",
    "UserKnownHostsFile=NUL",
    "-o",
    "ConnectTimeout=8",
    ...(lastBuild.identity ? ["-i", lastBuild.identity, "-o", "IdentitiesOnly=yes"] : []),
    target,
    remote,
  ];
  const r = spawnSync("ssh", args, { encoding: "utf8", timeout: 20000 });
  if (!sshReachable(r.status)) {
    return {
      reachable: false,
      output: String(r.stderr || r.error?.message || "connection failed").trim(),
    };
  }
  // Reachable → write the `ssh <hostname>` alias so the user can reach it
  // prompt-free from now on.
  let alias: string | undefined;
  if (lastBuild.hostname) {
    try {
      writeSshAlias(lastBuild.hostname, ip);
      alias = lastBuild.hostname;
    } catch {}
  }
  return { reachable: true, output: String(r.stdout ?? "").trim(), alias };
}

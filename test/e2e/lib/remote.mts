import { spawn } from "node:child_process";
import type { Target } from "./config.mts";

const BASE = ["-o", "ConnectTimeout=10", "-o", "StrictHostKeyChecking=accept-new", "-o", "ServerAliveInterval=5"];

export function sshArgs(key: string, user: string, ip: string, opts: { tty?: boolean } = {}): string[] {
  return [...(opts.tty ? ["-tt"] : []), "-i", key, ...BASE, `${user}@${ip}`];
}

export function scpArgs(key: string, src: string, user: string, ip: string, dst: string): string[] {
  return ["-i", key, ...BASE, src, `${user}@${ip}:${dst}`];
}

interface RunResult { code: number; stdout: string; stderr: string; out: string; }

function run(cmd: string, args: string[], input: string | null, timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { timeout: timeoutMs });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", d => stdout += d);
    p.stderr.on("data", d => stderr += d);
    if (input != null) {
      p.stdin.write(input);
      p.stdin.end();
    }
    p.on("close", code => resolve({ code: code ?? -1, stdout, stderr, out: stdout + stderr }));
    p.on("error", e => resolve({ code: -1, stdout: "", stderr: String(e), out: String(e) }));
  });
}

export function runBash(t: Target, script: string, key: string, timeoutMs = 240_000): Promise<RunResult> {
  return run("ssh", [...sshArgs(key, t.user, t.ip), "bash -s"], script, timeoutMs);
}

export function runPwsh(t: Target, script: string, key: string, timeoutMs = 240_000): Promise<RunResult> {
  return run("ssh", [...sshArgs(key, t.user, t.ip), "powershell -NoProfile -Command -"], script, timeoutMs);
}

export function push(t: Target, local: string, remote: string, key: string): Promise<RunResult> {
  return run("scp", scpArgs(key, local, t.user, t.ip, remote), null, 120_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll the guest with a trivial ssh echo until it answers, or throw once
 *  `tries` attempts are exhausted. reset() may return before the guest's
 *  sshd is actually reachable (VM boot + service start lag), so callers
 *  should await this right after reset() and before the first push/run. */
export async function waitForSsh(t: Target, key: string, tries = 12, delayMs = 3000): Promise<void> {
  for (let i = 0; i < tries; i++) {
    const r = await run("ssh", [...sshArgs(key, t.user, t.ip), "echo __ready__"], null, 15_000);
    if (r.code === 0 && r.out.includes("__ready__")) return;
    if (i < tries - 1) await sleep(delayMs);
  }
  throw new Error(`waitForSsh: ${t.user}@${t.ip} did not become reachable after ${tries} attempts`);
}

import { spawn } from "node:child_process";
import type { Target } from "./config.mts";

const BASE = ["-o", "ConnectTimeout=10", "-o", "StrictHostKeyChecking=accept-new", "-o", "ServerAliveInterval=5"];

export function sshArgs(key: string, user: string, ip: string, opts: { tty?: boolean } = {}): string[] {
  return [...(opts.tty ? ["-tt"] : []), "-i", key, ...BASE, `${user}@${ip}`];
}

export function scpArgs(key: string, src: string, user: string, ip: string, dst: string): string[] {
  return ["-i", key, ...BASE, src, `${user}@${ip}:${dst}`];
}

function run(cmd: string, args: string[], input: string | null, timeoutMs: number): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { timeout: timeoutMs });
    let out = "";
    p.stdout.on("data", d => out += d);
    p.stderr.on("data", d => out += d);
    if (input != null) {
      p.stdin.write(input);
      p.stdin.end();
    }
    p.on("close", code => resolve({ code: code ?? -1, out }));
    p.on("error", e => resolve({ code: -1, out: String(e) }));
  });
}

export function runBash(t: Target, script: string, key: string, timeoutMs = 240_000) {
  return run("ssh", [...sshArgs(key, t.user, t.ip), "bash -s"], script, timeoutMs);
}

export function runPwsh(t: Target, script: string, key: string, timeoutMs = 240_000) {
  return run("ssh", [...sshArgs(key, t.user, t.ip), "powershell -NoProfile -Command -"], script, timeoutMs);
}

export function push(t: Target, local: string, remote: string, key: string) {
  return run("scp", scpArgs(key, local, t.user, t.ip, remote), null, 120_000);
}

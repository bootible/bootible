---
description: Design for bootible's end-to-end test harness — runs the real provisioning artifacts against pristine ti Hyper-V VMs and validates the result
tags: [testing, e2e, ti, vms, provisioning, harness]
audience: { human: 45, agent: 55 }
purpose: { design: 70, plan: 10, reference: 20 }
---

# bootible E2E test harness — design

## Why

Today bootible has 368 tests, but **almost all are string assertions on generated artifacts**. Exactly one test (`deck-provision.integration.test.ts`, `skipIf(!bash)`) ever *executes* a generated script, and only under stubbed tools. **No Windows script has ever run in a test** — `strip.ps1`, `bootstrap.ps1`, `beacon.ps1`, `autounattend.xml` are only ever asserted as strings. The first real execution of `provision.sh` on an actual OS was a manual bazzite run on 2026-07-05, which immediately surfaced a real portability bug (`sudo -v` hang).

The `ti` VM test infrastructure (`G:\code\Tools\test-infrastructure`) gives pristine, reproducible Hyper-V VMs of bootible's target OSes. This harness uses them to run bootible's **real** provisioning artifacts against a known-clean machine, verify the result, and reset — closing the gap between "the generator emits the right string" and "the script actually works on the target."

## Mental model

For each test case: **boot pristine VM → generate the real bootible artifact → deliver + run it on the VM → assert the system changed as intended → reset to pristine.** The generators are imported directly (type-safe, the same code the app ships); only the imperative VM/SSH/`ti` steps shell out.

## Targets (from `ti`)

| VM | IP | Guest user | Role |
|---|---|---|---|
| `bazzite` | 172.30.90.13 | `test-infra` | SteamOS **proxy** (immutable/gamescope/Flatpak) — runs `provision.sh` |
| `cachyos` | 172.30.90.14 | `test-infra` | mutable-Arch cross-check — runs `provision.sh` |
| `win11` | 172.30.90.11 | `test-infra` | ROG **Pro** — strip kit, bootstrap, RDP, MS-account config |
| `win11home` | 172.30.90.15 | `test-infra` | ROG **Home** — strip kit, edition-gating |
| `steamos` | — | — | **Not virtualizable** (no Hyper-V drivers). Real-Deck manual only. |

SSH key: `C:\Users\gavin\.ssh\ti_ed25519`. Guest creds `test-infra`/`test-infra`, passwordless sudo (Linux) / local admin (Windows).

## Architecture

**A Node/TS harness in `bootible/test/e2e/`, launched from an elevated pwsh.**

- **Node/TS** because generation is TS (`generateDeckProvision`, `generateStripScript`, `buildUsbBundle`, `generateAutounattend`, …) — import it directly, no shelling out to generate; assertions and reporting stay type-safe.
- **Elevated** because `ti up`/`reset`/`down` drive Hyper-V (need elevation or Hyper-V Administrators). A Node process launched from an elevated shell inherits elevation, so its `ti`/`ssh`/`scp` children work.
- **Separate from `npm test`** — slow (minutes), needs VMs + elevation + network. Own entrypoint (`node test/e2e/run.mjs`), own config, not part of the gate.

### Components

1. **Case matrix** (`cases/`) — data-driven. Each case: `{ id, vm, kind, config, assertions[], timeoutMs, tags }`. Kinds:
   - `deck-provision` — generate `provision.sh`, run on a Linux VM, assert.
   - `strip-kit` / `bootstrap` — generate the Windows artifact, run on a Windows VM (PowerShell over SSH), assert.
   - `payload-validate` — pure generation; assert file contents. **No VM.**
2. **`ti` driver** (`lib/ti.mjs`) — thin wrappers: `up(vm)`, `reset(vm)`, `down(vm)`, `ip(vm)`. Invoke via `pwsh -Command "Import-Module <ti.psd1>; ti up <vm>"`.
3. **Remote runners** (`lib/remote.mjs`) — `scp` a script, `ssh`-run it, read files back. Linux → bash; Windows → PowerShell over SSH. TTY handling (`-tt` only when a sudo prompt is genuinely needed — the generator now guards `sudo -v`).
4. **Assertion library** (`lib/assert.mjs`) — reusable probes: `fileExists`, `flatpakInstalled`, `serviceEnabled`, `receiptOk(step)`, `regValue`, `wingetListed`, `portOpen`, `appxAbsent`.
5. **Reporter** (`lib/report.mjs`) — per-case pass/fail matrix, failing assertions listed, non-zero exit on any failure. Emits the same matrix the Artifact renders.

### The loop per case

- **Linux:** `ti up <vm>` → `generateDeckProvision(config)` (**ti key baked into `ssh.authorizedKeys`** — see Constraints) → `scp` → `ssh`-run → read `~/.bootible/receipt` + system probes → `ti reset <vm>`.
- **Windows strip/bootstrap:** `ti up <vm>` → generate the `.ps1`/`.bat` set → copy → run elevated over SSH → probe (`winget list`, reg keys, Appx absence, hostname, firewall/RDP) → `ti reset`.
- **Payload-validate:** call `buildUsbBundle`/`buildDeckBundle`/`generateAutounattend` → assert file set + contents. No VM, fast, runs first as a cheap gate.

## Coverage & classification

The full living matrix is the companion Artifact (test-coverage map). Classification rubric:

- **Auto** — headless + deterministic assertion.
- **Semi** — auto setup, one human confirm (MSA OOBE sign-in with a test account; boot-from-USB device pick).
- **Manual** — physical/interactive only (real-stick USB write/eject; bare-metal install boot; SteamOS-specific mechanisms with no VM).

**Per-feature isolation on bazzite:** beyond `minimal` and `everything-on`, each major toggle runs alone (decky-only, tailscale-only, proton-only, sunshine-only, vnc-only, emudeck-only, waydroid-only, stickdeck-only, pw-mgr-flatpak, pw-mgr-distrobox, static-ip, default-browser) so a failure pinpoints the feature and interactions surface.

### Windows Pro — account + RDP
- **RDP: Auto.** Run the `remote-desktop` module on `win11`; assert `fDenyTSConnections=0`, the Remote Desktop firewall group enabled, and port 3389 reachable from the host. Assert `win11home` does **not** add the module (edition gating).
- **MS account: config Auto + sign-in Semi.** Assert the generated `autounattend.xml` takes the semi-attended path (no `LocalAccounts`/`AutoLogon`, `HideOnlineAccountScreens=false`). The actual OAuth sign-in is a printed manual checklist step using the test MSA — it cannot be automated.

## Constraints & decisions

- **Elevation:** harness runs from an elevated pwsh. My (Claude) session is *not* elevated and cannot drive `ti` lifecycle verbs — the harness is authored here, executed from an elevated session.
- **The ti-key lockout gotcha:** bootible *owns* `~/.ssh/authorized_keys`. Every Linux case's config MUST include the ti public key in `ssh.authorizedKeys`, or the provision wipes it and the harness locks itself out. (Recovery: `ti reset`, or SSH with a GitHub key the provision authorized.)
- **SteamOS-proxy limits:** `steamos-readonly`, `/etc/atomic-update.conf.d` allowlist, Decky, the deck-tailscale sysext installer, and the SteamOS Waydroid installer **cannot** be validated on bazzite. These stay real-Deck-manual and are marked as such in the matrix; the harness asserts the *portable* behavior and that these steps warn-not-fail on the proxy.
- **Slow paths:** Proton-GE download, distrobox Arch container (+ `yay` compile) push a full run past ~10 min. Per-case timeouts; isolation runs keep individual cases fast.
- **Isolation:** `ti reset` between cases for a pristine slate; `ti down -All` at the end.
- **Network mutation:** static-IP cases risk cutting the VM's own network; run them last per VM or on a secondary path, and re-probe reachability after.

## Out of scope

- **Physical USB write/format/eject** — manual test (real stick; Hyper-V can't present a VHDX as `BusType='USB'`, and bootible's picker filters on that).
- **Bare-metal boot-from-USB install** — the autounattend *driving* a real Windows install; only the generated file + the first-boot `bootstrap.ps1` (run on an already-installed VM) are covered.
- **MSA OAuth sign-in** — interactive; semi-manual with the test account.
- **The Electron GUI itself** — covered by existing renderer unit tests; not driven headlessly here.

## Success criteria (testable)

1. `node test/e2e/run.mjs --kind payload-validate` passes with no VM, asserting the full generated file set for a representative ROG + Deck config.
2. From an elevated pwsh, `node test/e2e/run.mjs --vm bazzite` boots bazzite, runs `provision.sh` for every isolation case + `everything-on`, and reports per-feature pass/fail from the receipt + system probes, then resets.
3. `--vm win11` runs the strip kit and asserts installed apps, removed Appx, floor reg keys, and RDP enablement; `win11home` confirms RDP is *not* enabled.
4. The run emits a pass/fail matrix identical in shape to the companion Artifact and exits non-zero on any failure.
5. Every Linux case authorizes the ti key (no lockouts across a full run).

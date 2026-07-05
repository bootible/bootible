# bootible E2E harness

Bootible's end-to-end test harness runs the **real** provisioning artifacts (PowerShell scripts, bash scripts, autounattend XML) against pristine, reproducible Hyper-V VMs of bootible's target OSes (`win11`, `win11home`, `bazzite`, `cachyos`). Each case: boot pristine → generate artifact → deliver + run on VM → assert system changed → reset to clean.

The harness is **separate from `npm test`** (the fast unit gate). It is slow (minutes), needs Hyper-V + elevation, and runs only on demand.

## First-time setup

Copy the example config:

```bash
cp test/e2e/e2e.config.example.json test/e2e/e2e.config.json
```

The config points to:
- SSH key path (`C:\Users\gavin\.ssh\ti_ed25519`, already trusted on all guest VMs)
- `ti` PowerShell module path (`G:\code\Tools\test-infrastructure\ti\ti.psd1`)
- Target VM IPs and credentials (read-only; `test-infra` user with passwordless sudo on Linux, local admin on Windows)

## Case kinds

The harness has four case kinds, each covering a different testing surface. Run by kind with `--kind <name>`, or by VM with `--vm <name>`, or by ID with `--case <id>`.

### `payload-validate` — No VM required

Pure generation assertions. No VM orchestration.

- **What it does:** Call `buildUsbBundle()`, `genDeckBundle()`, `genAutounattend()`, etc., and assert the file set and content.
- **Speed:** Fast (< 1 second each).
- **When to run:** First, as a cheap gate. Catches obvious generation bugs before VM startup.

**Command:**

```bash
npm run test:e2e -- --kind payload-validate
```

Examples: `payload:rog-local`, `payload:autounattend-msa`, `payload:deck-bundle`.

### `deck-provision` — Linux (bazzite)

Linux provisioning: generate `provision.sh`, run on a Linux VM, read receipt and system probes.

- **What it does:** `ti up` → `genDeckProvision(config)` → `scp` script → `ssh`-run → assert output + system state → `ti reset`.
- **VM:** `bazzite` (SteamOS proxy). cachyos is a configured `ti` target (in `e2e.config.example.json`) but has **no harness cases yet** — all deck-provision cases currently target `bazzite`. Adding cachyos coverage means parameterizing the `deckCase` factory's VM.
- **Timeout budget:** 240s (~4 min) default; `deck:pw-distrobox` and `deck:everything-on` use 900s (~15 min, distrobox is slow).
- **Tier:** Auto (fully headless + deterministic).
- **Critical rule — ti-key authorization:** Every Linux case's config MUST include the `ti` public key in `ssh.authorizedKeys`. The provision script *owns* `~/.ssh/authorized_keys` and writes it fresh; if the key is missing, the script wipes it and you lock yourself out. See [Constraints](#constraints--ti-key-authorization) below.

**Command (all bazzite cases):**

```bash
npm run test:e2e -- --vm bazzite
```

**Command (single case):**

```bash
npm run test:e2e -- --case deck:minimal
```

Examples: `deck:minimal`, `deck:flatpak-apps`, `deck:tailscale`, `deck:static-ip`, `deck:sunshine`.

### `strip-kit` — Windows (win11 / win11home)

Windows bloatware removal: generate the removal script + launcher, run on a Windows VM, verify apps gone and settings changed.

- **What it does:** `ti up` → `genStripKit(config)` → push `.ps1` + `.bat` → run elevated over SSH → assert Appx absence, winget list, registry keys, hostname unchanged.
- **VMs:** `win11` (Pro edition), `win11home` (Home edition).
- **Timeout budget:** 900s (~15 min).
- **Tier:** Auto (fully headless + deterministic).
- **Key assertion:** Removal happens correctly **without reboot** (the script is idempotent and runs as-is from the harness, not wrapped in an installer).

**Command (all win11 cases):**

```bash
npm run test:e2e -- --vm win11
```

**Command (all win11home cases):**

```bash
npm run test:e2e -- --vm win11home
```

**Command (single case):**

```bash
npm run test:e2e -- --case strip:win11-full
```

Examples: `strip:win11-full`, `strip:win11home-minimal`.

### `bootstrap` — Windows (win11 / win11home) + modules

Windows system configuration: generate a module script (remote-desktop, ssh-key, power, etc.), run on a Windows VM, assert the effect.

- **What it does:** `ti up` → `genStripKit()` with modules → push → run elevated over SSH → assert registry keys, services running, firewall rules, ports open.
- **VMs:** `win11`, `win11home`.
- **Timeout budget:** 300s (~5 min).
- **Tiers:** Auto (deterministic RDP, SSH, power) or Semi (manual MSA sign-in).
- **Edition gating:** RDP module only runs on Pro; Home cases assert it is *not* applied.

**Command (all win11 bootstrap cases):**

```bash
npm run test:e2e -- --vm win11 --kind bootstrap
```

**Command (single case):**

```bash
npm run test:e2e -- --case bootstrap:ssh-on-windows
```

Examples: `bootstrap:rdp-pro`, `bootstrap:ssh-on-windows`, `bootstrap:msa-semi` (skipped; semi-manual).

### `discovery` — Linux (bazzite)

End-to-end device discovery: run a Deck provision with a fixed `buildId`, listen for the end-of-provision beacon on the host, and verify the app's beacon parser recognizes it.

- **What it does:** Bind UDP listener on BEACON_PORT → `ti up bazzite` → generate & run `provision.sh` with a known `buildId` → assert beacon arrives within 30s.
- **VM:** `bazzite` only.
- **Duration:** ~4 min.
- **Tier:** Auto (fully headless + deterministic).
- **Key insight:** `ti-net` carries mDNS/multicast, so the guest's broadcast beacon reaches the host socket, same as in the real app.

**Command:**

```bash
npm run test:e2e -- --case discovery:beacon-e2e
```

## Elevated PowerShell requirement

Lifecycle commands (`ti up`, `ti reset`, `ti down`) drive Hyper-V and **require elevation** (admin user or Hyper-V Administrators membership).

- **`payload-validate` cases:** Do NOT need elevation (no VMs).
- **All other cases (`deck-provision`, `strip-kit`, `bootstrap`, `discovery`):** Must run from an elevated PowerShell.

**To run elevated:**

```powershell
# Option 1: Open elevated pwsh manually, then:
npm run test:e2e -- --vm bazzite

# Option 2: Use sudo (if enabled):
sudo pwsh -c "npm run test:e2e -- --vm bazzite"
```

## Command reference

```bash
# All payload-validate cases (fast, no elevation needed)
npm run test:e2e -- --kind payload-validate

# All cases for a specific VM
npm run test:e2e -- --vm bazzite
npm run test:e2e -- --vm win11
npm run test:e2e -- --vm win11home

# All cases of a specific kind
npm run test:e2e -- --kind deck-provision
npm run test:e2e -- --kind strip-kit
npm run test:e2e -- --kind bootstrap
npm run test:e2e -- --kind discovery

# Single case by ID
npm run test:e2e -- --case deck:minimal
npm run test:e2e -- --case strip:win11-full
npm run test:e2e -- --case bootstrap:rdp-pro

# Combine filters (kind + vm)
npm run test:e2e -- --kind bootstrap --vm win11
```

## Constraints & ti-key authorization

### ti-key rule (CRITICAL for Linux cases)

Bootible *owns* `~/.ssh/authorized_keys` on Linux. The provision script writes it fresh, then appends any GitHub-authorized users. **If the ti public key is not in the case's `ssh.authorizedKeys` config, the script wipes it and the harness locks itself out.**

Every Linux case (`deck-provision`, `discovery`) must use `withTiKey(config)` in `generate.mts`. This function adds the ti public key to the config's `ssh.authorizedKeys` before generation. If you see a case without it, fix it.

**Recovery if locked out:**
- `ti reset <vm>` (re-boots pristine).
- Or SSH in with a key the provision *did* authorize (e.g. a matching GitHub key).

### Elevation

Only needed for VM lifecycle. `ti ssh` and `ti ip` do not require elevation.

### SteamOS is not testable

Real SteamOS has no Hyper-V drivers and cannot run as a Hyper-V guest. Use `bazzite` as the immutable-OS proxy for automated tests. SteamOS-specific validation (decky, sysext, real-Deck-only features) happens on a physical Steam Deck and is marked as manual in the coverage map.

## Exit codes

- `0` — All cases passed (or all failures were skipped).
- `1` — At least one case failed or an error occurred.
- Cases with a `skipped` field (e.g., semi-manual or manual tiers) do not cause non-zero exit; they are excluded from the failure check. The `skipped` field indicates why the case was skipped (e.g., "manual OOBE sign-in with test MSA").

## Reporting

The harness emits a per-case pass/fail matrix with failing assertions listed. The matrix shape matches the companion test-coverage artifact (a spreadsheet showing which cases cover which features and devices).

## Relationship to `npm test`

`npm test` is the fast unit gate (vitest, TypeScript check, linting). It runs in CI and is gated on every commit. The E2E harness is **not** part of that gate — it is separate, runs locally on demand, and requires manual lift (Hyper-V + elevation). Unit tests in `test/e2e/**/*.test.ts` DO run in the gate (fast payload validation); the VM orchestration does not.

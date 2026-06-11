---
title: How Drift Detection Works
description: The drift detection contract — exactly what is probed, where the baseline lives, when detection runs, and how repairs are verified
---

# How Drift Detection Works

This is the contract page for Bootible's drift detection on the ROG Ally (Windows). For the friendly walkthrough — what a drift report looks like and when you'll see one — read [Re-running & Drift](../post-install/re-running.md) first. This page documents the exact probes, paths, and semantics, verified against the source: `config/rog-ally/lib/state-snapshot.ps1` and the drift blocks in `config/rog-ally/Run.ps1`.

Drift detection is currently a ROG Ally (Windows) feature. The Steam Deck path relies on Ansible's idempotency instead — re-running converges state but does not keep a baseline.

---

## A detector, not a compliance engine

Bootible records a snapshot of known-good state at the end of every real run and compares against it at the start of the next one. That makes it a **drift detector**: an external change is reported once, and then the post-run state — whatever it is — becomes the new baseline.

Two consequences worth being explicit about:

- **Drift you choose to keep is accepted.** If a run ends with a setting still in its drifted state (because your config no longer manages it, or the module could not restore it), that state is saved as the new baseline. It will not be reported again.
- **New state is not drift.** The comparison iterates the *expected* keys only (`Compare-StateSnapshot`); keys that appear in the live state but not in the baseline are ignored.

---

## The probe list

`Get-LiveState` gathers exactly six keys. Each probe is wrapped in its own `try/catch` — a failing probe omits its key rather than failing the run.

| Key | What is read |
|-----|--------------|
| `hibernate_enabled` | Registry: `HKLM:\SYSTEM\CurrentControlSet\Control\Power` value `HibernateEnabled` (drifted when its value differs from your baseline — enabling hibernate when your baseline had it off is also drift). A registry read, not `powercfg` output parsing — locale-independent. |
| `gamebar_present` | Whether the `Microsoft.XboxGamingOverlay` Appx package is installed (`Get-AppxPackage`) — detects Xbox Game Bar being reinstalled. |
| `gpu_driver` | CIM query `Win32_VideoController`, filtered to adapters whose `PNPDeviceID` starts with `PCI\` (first match), reading `DriverVersion`. The PCI filter exists because streaming tools install virtual display adapters that would otherwise flap this probe. |
| `wallpaper_value` | Registry: `HKCU:\Control Panel\Desktop` value `WallPaper`. Only probed when your config sets `wallpaper_path`. The actual registry value is stored, so a *replaced* wallpaper is drift, not just an unset one. |
| `sshd_running` | Whether the `sshd` service exists and is in the `Running` state (`Get-Service`). |
| `hags_enabled` | Registry: `HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers` value `HwSchMode` (hardware-accelerated GPU scheduling is "on" when it equals `2`). |

These raw keys appear in console warnings; the receipt uses friendly labels from `$driftFriendlyNames` in `Run.ps1` ("Hibernate setting", "Xbox Game Bar presence", "GPU driver version", "Desktop wallpaper", "SSH server state", "Hardware-accelerated GPU scheduling").

**What is deliberately not probed:** display settings — HDR and refresh rate. Bootible's `display` module can set them, but you change them at will on a handheld; treating that as drift would make every report noise. They are re-applied by a re-run like everything else, just never reported as drift.

---

## Where the baseline lives

```
<bootible root>\private\device\rog-ally\<Instance>\state.json
```

`Run.ps1` builds the path from the private repo clone and the selected device instance. The snapshot is JSON, written by `Save-StateSnapshot` at the end of every real run.

**It is local-only by design.** The file sits inside your private repo clone, but Bootible never commits it: the log-push code in the bootstrap stages only `device/<platform>/<instance>/Logs/*.log`. The rationale (from the `state-snapshot.ps1` header): after a fresh install, a pushed baseline from the old install would scream drift on every key — a reinstalled device should start a new baseline instead.

---

## When drift detection does not run

The pre-run comparison is skipped entirely when any of these hold:

- **Tag-filtered runs** (`-Tags base,apps` …). A partial run cannot claim repair, so it neither reports drift nor counts as a baseline run.
- **No instance selected.** Detection requires a private device instance (`private/device/rog-ally/<Instance>/config.yml`). Defaults-only runs have no instance directory to keep a baseline in.
- **No baseline yet.** On a first run — or any time `state.json` is missing, empty, or unparseable — `Read-StateSnapshot` returns nothing and the comparison is silently skipped.

Dry runs are a half-case: a dry run **reads** the baseline and reports drift (with `[DRY RUN] A real run would re-apply your configuration`), but the baseline is only ever **written** on a real run. A dry run never re-baselines.

---

## The verified-repair flow

Bootible does not assume that running the modules fixed the drift — it checks.

1. **Pre-run:** live state is probed and diffed against the baseline. Drifted keys are reported under `DRIFT DETECTED SINCE LAST RUN`, and all of them except `gpu_driver` are recorded as repair candidates.
2. **Modules run** as normal — there is no special "repair mode"; re-applying your configuration is the repair.
3. **Post-run:** live state is probed once more. `Get-VerifiedRepairs` splits the pre-run drift into:
   - **Repaired** — the post-run value equals the baseline's expected value. The receipt gets `Repaired drift: <label>`.
   - **Unrepaired** — anything else. The console warns `Drift not repaired: <key>` and the receipt gets `Drift detected (not repaired): <label>`.
4. **Re-baseline:** the post-run state is saved as the new `state.json`, whatever the repair outcome.

The receipt only ever claims a repair that was verified against the post-run probe — never "we ran the module, so it must be fixed."

### GPU drivers are report-only

`gpu_driver` is excluded from the repair candidates before the modules run. A changed driver version is reported (`GPU driver changed - bootible reports this but will NOT roll drivers back`) and then accepted into the new baseline. Bootible never rolls a driver back.

---

## Related pages

- [Re-running & Drift](../post-install/re-running.md) — when you'll see a drift report and what to do with it
- [It Finished — Now What](../post-install/index.md) — the receipt, where the `Repaired drift:` lines land
- [ROG Ally Modules](rog-ally-modules.md) — what each module re-applies

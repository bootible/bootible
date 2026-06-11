---
title: CLI Reference
description: Command-line options for Bootible
---

# CLI Reference

Command-line usage for Bootible bootstrap scripts and runners.

---

## Bootstrap Commands

The one-liner commands that download and run Bootible. Both default to a **dry run** — nothing is changed until you run `bootible`.

### Steam Deck

```bash
curl -fsSL https://bootible.dev/deck | bash
```

**What it does:**

1. Downloads `deck.sh` from bootible.dev (with SHA256 integrity verification)
2. Clones the bootible repo to `~/bootible`
3. Runs the configuration in check mode (dry run)
4. Installs the `bootible` command for the real run

### ROG Ally

```powershell
irm https://bootible.dev/rog | iex
```

**What it does:**

1. Downloads `ally.ps1` from bootible.dev (with SHA256 integrity verification; falls back to GitHub if bootible.dev is unavailable)
2. Clones the bootible repo to `%USERPROFILE%\bootible`
3. Runs `Run.ps1` in dry-run mode
4. Installs the `bootible` command for the real run

---

## The `bootible` Command

After bootstrap, `bootible` is installed for easy re-runs. It is a thin wrapper around the platform runner — a **real run** by default (you already did the dry run via the one-liner).

### Steam Deck

```bash
bootible
```

**Location:** `/usr/local/bin/bootible`

**What it runs:**

```bash
cd ~/bootible && git pull && BOOTIBLE_RUN=1 ./targets/deck.sh "$@"
```

`deck.sh` takes no flags — it prompts for instance selection and runs the full Ansible playbook. For dry runs, re-run the curl one-liner; for tag-scoped runs, [run ansible-playbook manually](#steam-deck-running-ansible-manually).

### ROG Ally

```powershell
bootible
```

**Location:** `%LOCALAPPDATA%\Microsoft\WindowsApps\bootible.cmd` (falls back to `%USERPROFILE%\bootible\bootible.cmd`, added to PATH)

**What it runs:**

```
powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\bootible\config\rog-ally\Run.ps1" %*
```

It forwards all arguments to `Run.ps1`, so `bootible` accepts the same parameters:

```powershell
bootible -DryRun
bootible -Tags base,apps
```

---

## ROG Ally: Run.ps1 Parameters

`Run.ps1` accepts exactly three parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `-ConfigFile <path>` | string | Merge a specific config file on top of the defaults. When set (the bootstrap does this), the `~/.config` local layer and private-repo instance selection are bypassed. |
| `-Tags <list>` | string[] | Run only the listed modules. There is no skip flag — list what you want, or disable modules in config. |
| `-DryRun` | switch | Preview changes without applying them. |

```powershell
cd $env:USERPROFILE\bootible\config\rog-ally

# Dry run
.\Run.ps1 -DryRun

# Specific modules
.\Run.ps1 -Tags base,apps

# Specific config file
.\Run.ps1 -ConfigFile C:\path\to\config.yml
```

### Available Tags

Tags are module names, executed in this fixed order:

| Tag | Description |
|-----|-------------|
| `validate` | Package validation (dry-run only) |
| `base` | Hostname, network, winget, directory scaffolding |
| `apps` | Desktop applications |
| `gaming` | Game platforms |
| `streaming` | Streaming clients |
| `remote_access` | VPN, remote desktop, RDP |
| `ssh` | OpenSSH configuration |
| `emulation` | EmuDeck |
| `rog_ally` | Device-specific tools |
| `optimization` | Gaming tweaks |
| `power` | Sleep/hibernate, power button, CPU boost |
| `display` | HDR toggle, refresh rate |
| `debloat` | Privacy settings |
| `health` | Post-install health checks |

**Examples:**

```powershell
# Only base and gaming
.\Run.ps1 -Tags base,gaming

# Dry run the display module
.\Run.ps1 -Tags display -DryRun
```

---

## Steam Deck: Running Ansible Manually

The Steam Deck uses Ansible under the hood. The `bootible` wrapper doesn't accept flags, but you can run the playbook directly for tag-scoped or verbose runs:

```bash
cd ~/bootible/config/steamdeck

# Basic
ansible-playbook playbook.yml --ask-become-pass

# With private config
ansible-playbook playbook.yml --ask-become-pass \
  -e @../../private/device/steamdeck/MySteamDeck/config.yml \
  -e device_instance=MySteamDeck

# Check mode (dry run)
ansible-playbook playbook.yml --check --ask-become-pass

# Only specific tags
ansible-playbook playbook.yml --tags ssh,tailscale --ask-become-pass

# Skip specific tags
ansible-playbook playbook.yml --skip-tags decky --ask-become-pass
```

### Available Tags

| Tag(s) | Description |
|--------|-------------|
| `always` | Always runs (pre-tasks, post-tasks) |
| `base` | Base setup (Flathub, hostname) |
| `apps`, `flatpak` | Flatpak applications |
| `ssh`, `remote` | SSH configuration |
| `tailscale`, `remote`, `vpn` | Tailscale VPN |
| `remote_desktop`, `remote`, `streaming` | Sunshine/remote desktop |
| `decky`, `plugins`, `gaming` | Decky Loader |
| `proton`, `gaming`, `wine` | Proton tools |
| `emulation`, `roms`, `gaming` | EmuDeck |
| `stickdeck`, `controller`, `gaming` | StickDeck |
| `waydroid`, `android` | Waydroid |
| `distrobox`, `containers`, `password_manager` | Distrobox apps |

---

## Reference

### Environment Variables

=== "Steam Deck (`deck.sh`)"

    | Variable | Description |
    |----------|-------------|
    | `BOOTIBLE_RUN` | `1` = real run. Unset/`0` = dry run (the curl one-liner default). The `bootible` wrapper sets this for you. |

    `deck.sh` also accepts a single positional argument: the private repo URL.

=== "ROG Ally (`ally.ps1`)"

    | Variable | Description |
    |----------|-------------|
    | `BOOTIBLE_PRIVATE` | Private repo URL to clone (skips the interactive prompt) |
    | `BOOTIBLE_RUN` | `1` = real run. Unset = dry run (the irm one-liner default). |
    | `BOOTIBLE_DIRECT` | Internal — marks the re-launched-from-saved-file process (fixes piped-stdin and git credential manager issues); don't set manually |
    | `BOOTIBLE_TRANSCRIPT` | Internal — transcript path handoff between `ally.ps1` and `Run.ps1` |

### Exit Behavior

A non-zero exit code means the run failed. `Run.ps1` exits `1` on setup failures (not Windows, not Administrator, winget unavailable, no package sources, YAML parser missing, or config validation errors). There is no extended exit-code table.

### Logging

=== "Steam Deck"

    Transcript logs are committed to your private repo per instance:

    ```
    private/device/steamdeck/<instance>/Logs/
    ```

=== "ROG Ally"

    Transcript logs are committed to your private repo per instance:

    ```
    private\device\rog-ally\<instance>\Logs\
    ```

    A machine-readable JSON run log is also appended locally (one file per day):

    ```
    %USERPROFILE%\.bootible\logs\run-YYYYMMDD.json
    ```

Transcript logs are automatically pushed to your private repo after each run.

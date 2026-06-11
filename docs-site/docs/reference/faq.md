---
title: FAQ
description: Frequently asked questions about Bootible
---

# Frequently Asked Questions

Answers to common questions about Bootible.

---

## General

### What is Bootible?

Bootible is an automation tool that configures gaming handhelds with a single command. It installs apps, applies system tweaks, and sets up gaming enhancements—all from a YAML configuration file.

### Is it safe to run?

Yes! Bootible:

- **Runs dry-run first** - Shows what would change without doing anything
- **Creates backups** - Btrfs snapshots (Steam Deck) or System Restore (Windows)
- **Is idempotent** - Safe to run multiple times
- **Is open source** - You can read every line of code

### Do I need a GitHub account?

No, but it's recommended. Without GitHub:

- Bootible runs with default settings
- Logs are saved locally only
- Can't sync config across devices

With GitHub:

- Store custom configuration privately
- Sync across multiple devices
- Logs automatically pushed to your repo
- SSH key management

### Can I undo changes?

Yes!

- **Steam Deck:** Restore from btrfs snapshot
- **ROG Ally:** Use System Restore

See [Troubleshooting](../post-install/troubleshooting.md#backup--recovery) for details.

### Is my configuration private?

If you use a private GitHub repository, yes. Your config stays private to you. Bootible never sends your configuration anywhere except your own repo.

---

## Running Bootible

### What does the first command do?

```bash
curl -fsSL https://bootible.dev/deck | bash
```

This:

1. Downloads the bootstrap script
2. Verifies its integrity (SHA256 checksum)
3. Runs in dry-run mode (preview only)
4. Shows what would change
5. Installs the `bootible` command

### What does `bootible` do?

Running `bootible` after the bootstrap:

1. Applies your configuration
2. Installs packages
3. Configures system settings
4. Pushes logs to your repo

### Can I run it multiple times?

Yes! Bootible is **idempotent**:

- Already-installed packages are skipped
- Settings are only changed if different
- No duplicate entries or configurations

Run it whenever you change your config or after system updates.

### How do I update my config?

1. Edit your `config.yml` in your private repo
2. Push changes to GitHub
3. Run `bootible` on your device

The device pulls the latest config automatically.

---

## Configuration

### Where do I put my config?

In your private repository at:

```
private/device/<platform>/<device-name>/config.yml
```

Example:
```
private/device/steamdeck/MySteamDeck/config.yml
```

### Do I need to include everything?

No! Only include settings you want to change from defaults. Bootible merges your config with defaults.

```yaml
# Minimal config - just what you want different
hostname: "my-deck"
install_discord: true
install_spotify: true
```

### How do I see all available options?

See the Configuration Reference:

- [Steam Deck Config](../configure/steam-deck.md)
- [ROG Ally Config](../configure/rog-ally.md)

Or look at the default config files in the repo.

### Can I use environment variables?

The config file is pure YAML, not templated. However:

- GitHub tokens can be passed via CLI or device flow
- Paths can use variables where noted

---

## Steam Deck Specific

### Will my changes survive SteamOS updates?

| What | Survives? |
|------|-----------|
| Flatpak apps | Yes |
| Your config | Yes (in private repo) |
| Decky Loader | No - reinstall needed |
| Pacman packages | No |
| SSH keys | Yes |
| Tailscale | Yes |

After an update, just run `bootible` again.

### What's Decky Loader?

Decky adds plugins to Gaming Mode. Access via **... button > plug icon**.

Popular plugins:

- PowerTools (performance control)
- ProtonDB Badges (compatibility ratings)
- CSS Loader (themes)

### Why Flatpak instead of pacman?

SteamOS has an immutable root filesystem. Pacman packages:

- Require unlocking the filesystem
- Get wiped on every SteamOS update
- Can cause stability issues

Flatpak apps survive updates and are sandboxed.

### Can I use pacman packages?

Bootible supports it (`package_managers.pacman: true`) but it's not recommended. You'll need to reinstall after every SteamOS update.

---

## ROG Ally Specific

### Does Bootible work on Legion Go/other handhelds?

ROG Ally config works on any Windows handheld. Device-specific tools (Armoury Crate) only apply to ROG devices.

For other handhelds, disable ROG-specific options:

```yaml
install_rog_ally: false
```

### Will debloat break anything?

Bootible's debloat is conservative:

- Doesn't remove system apps
- Doesn't break Windows Update
- Changes are reversible via System Restore

If something breaks, restore from the auto-created restore point.

### Why not use Chris Titus Tech's tool?

Bootible and debloaters like CTT serve different purposes:

- CTT: One-time deep Windows debloat
- Bootible: Repeatable configuration with gaming focus

You could use both—run CTT once, then Bootible for ongoing config.

---

## Private Repository

### What should I put in my private repo?

```
private/
├── device/
│   └── steamdeck/
│       └── MySteamDeck/
│           ├── config.yml      # Your settings
│           ├── Images/         # Wallpapers
│           └── Logs/           # Auto-pushed logs
├── scripts/                    # EmuDeck EA, etc.
└── ssh-keys/                   # SSH public keys
```

### What should I NOT put in my private repo?

- Passwords
- API tokens/secrets
- Private SSH keys (only `.pub` files!)
- Anything you wouldn't want leaked

### Can I share my config?

Yes! Just remove/redact:

- Hostnames and IPs
- SSH key references
- Any personal paths

---

## Troubleshooting

### Where are the logs?

- **Steam Deck:** `~/bootible/private/device/steamdeck/<name>/Logs/`
- **ROG Ally:** PowerShell creates a transcript in your device folder

### It didn't install something - why?

Common reasons:

1. **Not enabled:** Check config has `install_*: true`
2. **Condition not met:** Some features need others first
3. **Package ID changed:** Winget IDs can change
4. **Network issue:** Temporary download failure

Run dry-run to see what would happen:

=== "Steam Deck"

    ```bash
    cd ~/bootible/config/steamdeck
    ansible-playbook playbook.yml --check --ask-become-pass
    ```

=== "ROG Ally"

    ```powershell
    .\Run.ps1 -DryRun
    ```

### How do I report a bug?

[Open an issue](https://github.com/bootible/bootible/issues) with:

1. Device and OS version
2. Relevant config (remove secrets!)
3. Full error output
4. Steps to reproduce

---

## Contributing

### Can I contribute?

Yes! Bootible is open source. Contributions welcome:

- Bug reports and fixes
- New features
- Documentation improvements
- Platform support

### How do I test changes locally?

Fork the repo, make changes, and test on your device by pointing the bootstrap at your fork.

### What's the code structure?

```
bootible/
├── targets/          # Bootstrap scripts
│   ├── deck.sh       # Steam Deck
│   └── ally.ps1      # ROG Ally
├── config/
│   ├── steamdeck/    # Ansible playbook + roles
│   └── rog-ally/     # PowerShell modules
├── cloudflare/       # Website
└── docs-site/        # This documentation
```

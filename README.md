# Bootible

> The missing first hour for Windows handhelds — one-liner setup for gaming handhelds.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/Docs-docs.bootible.dev-blue)](https://docs.bootible.dev)
[![Discord](https://img.shields.io/badge/Discord-Join-7289da?logo=discord&logoColor=white)](https://discord.gg/bootible)

Every new Windows handheld owner hits the same three walls:

- **Your handheld drains battery while "sleeping."** Windows modern standby keeps the device half-awake; you pick it up the next day and the battery is gone. Bootible switches sleep to hibernate so closing the lid actually means off.
- **Setup is a 10-step checklist you do by hand.** Debloat, privacy tweaks, G-Helper, launchers, streaming clients — every guide walks you through the same steps, one at a time, on an on-screen keyboard. Bootible runs the checklist for you.
- **Windows Update quietly breaks what you fixed.** An update lands and your carefully applied settings revert. Re-run Bootible and it detects the drift and re-applies your config — and only reports a repair after verifying the fix actually took.

## Quick Start

### ROG Ally

Run in **PowerShell as Administrator**:

```powershell
irm https://bootible.dev/rog | iex
```

That's it! Bootible runs in **dry-run mode** by default — you see every change before anything is touched. When ready, just type `bootible` to apply.

Want the latest changes from `main` instead of the tagged release? Use the beta channel:

```powershell
irm https://bootible.dev/rog-beta | iex
```

Both channels are served with checksum verification.

### Steam Deck

```bash
curl -fsSL https://bootible.dev/deck | bash
```

## Why Bootible?

- **Re-running repairs drift.** Bootible snapshots known-good state, detects what an update reverted, and re-applies your config on the next run. Repairs are verified post-run before they're claimed.
- **Config lives in YOUR repo.** Your setup is YAML in your own private GitHub repo — version it, review it, reuse it across as many devices as you like with per-device instances. No data is collected or stored anywhere else.
- **Dry-run by default.** The one-liner never changes anything on first contact. You read the preview, then opt in.
- **A receipt on your Desktop.** After every run, `Bootible - Read Me.md` lands on the Desktop: apps installed, changes applied, and an FAQ — so you (or whoever you set the device up for) can see exactly what happened.

![Bootible receipt on the Desktop](docs-site/docs/assets/receipt-demo.png)
<!-- captured during the v1.0 RC run -->

Bootible also detects Smart App Control — known to break Armoury Crate on the Ally — and gives you guidance before it becomes a problem. App installs run per-app through winget with automatic source recovery, so one flaky source doesn't sink the run. For what Bootible deliberately does NOT do (TDP profiles, driver rollback), see the [checklist parity table](docs/checklist-parity.md).

## Supported Devices

| Device | Platform | Status |
|--------|----------|--------|
| **Steam Deck** | SteamOS | Ready |
| **ROG Ally** (all variants) | Windows 11 | Ready |
| Bazzite | Fedora | Planned |
| Windows Desktop | Windows 10/11 | Planned |
| More handhelds | Various | Planned |

Want support for another device? [Start a discussion](https://github.com/bootible/bootible/discussions)!

---

## Documentation

Full documentation is available at **[docs.bootible.dev](https://docs.bootible.dev)**:

- [Getting Started](https://docs.bootible.dev/getting-started/) - First run walkthrough
- [Configuration](https://docs.bootible.dev/configuration/) - All config options
- [Features](https://docs.bootible.dev/features/) - Streaming, emulation, remote access
- [Troubleshooting](https://docs.bootible.dev/reference/troubleshooting/) - Common issues

---

## Community

- [GitHub Discussions](https://github.com/bootible/bootible/discussions) - Questions, ideas, show & tell
- [GitHub Project](https://github.com/users/gavinmcfall/projects/2) - Roadmap and progress
- [Discord](https://discord.gg/bootible) - Chat with the community
- [Issues](https://github.com/bootible/bootible/issues) - Bug reports and feature requests

---

## Contributing

Contributions welcome! Architecture and conventions live at [docs.bootible.dev](https://docs.bootible.dev) and in the [docs/](docs/) folder.

1. Fork the repo
2. Create a feature branch
3. Submit a PR

---

## ☕ Support

If you find this project helpful, consider supporting my work:

[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20Me-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/gavinmcfall)

---

## License

Bootible is open source software licensed under the [MIT License](LICENSE).

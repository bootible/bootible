# Bootible

> One-liner setup for gaming handhelds.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/Docs-docs.bootible.dev-blue)](https://docs.bootible.dev)
[![Discord](https://img.shields.io/badge/Discord-Join-7289da?logo=discord&logoColor=white)](https://discord.gg/bootible)

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

## Quick Start

### Steam Deck

```bash
curl -fsSL https://bootible.dev/deck | bash
```

### ROG Ally

Run in **PowerShell as Administrator**:

```powershell
irm https://bootible.dev/rog | iex
```

That's it! Bootible runs in **dry-run mode** by default so you can preview changes. When ready, just type `bootible` to apply.

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

Contributions welcome! See the [docs/ai-context](docs/ai-context/) folder for architecture and conventions if you're using an LLM to help.

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

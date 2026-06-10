## If something looks broken

### Armoury Crate stopped working / parts of it won't start
Windows **Smart App Control** blocks Armoury Crate components (ROG Live Service, ACSetup). Check it under
Settings → Privacy & security → Windows Security → App & browser control.
Heads-up: turning Smart App Control off is **one-way** — re-enabling it requires resetting Windows.
Most Ally owners use **G-Helper** instead (bootible can install it: `install_ghelper: true`).

### An app failed to install
Usually a winget source hiccup. Open PowerShell and run:

    winget source reset --force
    winget source update
    bootible

bootible retries this automatically once per run, but sources can stay flaky on fresh installs.

### My device sleeps and the battery dies anyway
If your config sets `sleep_mode: hibernate`, the power button and idle timeout hibernate instead of using
Modern Standby (which drains 10–23% in 12 hours on these devices). If battery still drains overnight,
check Settings → System → Power for anything resetting these — then just run `bootible` to re-apply.

### Windows Update broke my settings
This is normal, unfortunately — updates reinstall bloat, reset power settings, and occasionally downgrade
drivers. Run `bootible` again: it detects what drifted and re-applies your configuration.

### Where are the logs?
Each run writes a transcript into your private config repo under your device's `Logs/` folder, and it's
pushed automatically when possible.

## Help & links

- Docs & troubleshooting: https://docs.bootible.dev/reference/troubleshooting/
- Report a bug: https://github.com/bootible/bootible/issues
- Community Discord: https://discord.gg/bootible

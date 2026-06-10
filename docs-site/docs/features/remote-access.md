---
title: Remote Access
description: SSH, Tailscale, and remote management for your handheld
---

# Remote Access

Manage your gaming handheld remotely via SSH, VPN, or remote desktop.

---

## SSH

Secure shell access for command-line management.

### Why SSH?

- Transfer files with `scp` or `rsync`
- Run commands remotely
- Manage your device without physical access
- Automate tasks with scripts

### Setup

=== "Steam Deck"

    ```yaml
    install_ssh: true
    ssh_generate_key: true
    ssh_add_to_github: true
    ssh_import_authorized_keys: true
    ssh_authorized_keys:
      - "desktop.pub"
      - "laptop.pub"
    ```

=== "ROG Ally"

    ```yaml
    install_ssh: true
    ssh_server_enable: true
    ssh_authorized_keys:
      - "desktop.pub"
      - "laptop.pub"
    ```

    !!! note "No key management on Windows"
        Key generation/GitHub upload options (`ssh_generate_key`, `ssh_add_to_github`) are Steam Deck-only. They were removed from the Ally config — key management may return there as a future feature.

### Managing SSH Keys

Place public keys in your private repo:

```
private/
└── ssh-keys/
    ├── desktop.pub
    ├── laptop.pub
    └── phone.pub
```

Then reference them in your config to authorize access.

### Connecting

Once SSH is enabled:

```bash
# Steam Deck (default user: deck)
ssh deck@192.168.1.100

# ROG Ally (your Windows username)
ssh username@192.168.1.101
```

### Security Best Practices

1. **Use key authentication** - Disable password auth
2. **Change default port** - `ssh_port: 2222` (Steam Deck only)
3. **Use Tailscale** - Instead of exposing ports
4. **Limit authorized keys** - Only add trusted devices

---

## Tailscale

Zero-config mesh VPN for secure access from anywhere.

### What is Tailscale?

Tailscale creates an encrypted network between your devices:

- No port forwarding needed
- Works through firewalls and NAT
- Each device gets a stable IP (100.x.x.x)
- Free for personal use (up to 100 devices)

### Setup

=== "Steam Deck"

    ```yaml
    install_tailscale: true
    ```

=== "ROG Ally"

    ```yaml
    install_tailscale: true
    ```

### First-Time Setup

After Bootible runs:

```bash
# Authenticate with Tailscale
tailscale up

# Follow the URL to log in
```

On Windows, use the Tailscale tray app.

### Using Tailscale

Once connected, access your device from anywhere:

```bash
# SSH via Tailscale IP
ssh deck@100.64.1.2

# Or use the device name
ssh deck@steamdeck
```

### Tailscale Control (Steam Deck)

Enable the Decky plugin to control Tailscale from Gaming Mode:

```yaml
decky_plugins:
  tailscale_control:
    enabled: true
```

### Benefits Over Port Forwarding

| Feature | Tailscale | Port Forwarding |
|---------|-----------|-----------------|
| Setup | One command | Router config |
| Security | End-to-end encrypted | Exposed port |
| NAT issues | None | Often problematic |
| IP changes | No effect | Breaks connection |
| Multiple devices | Automatic mesh | Each needs setup |

---

## Remote Desktop

Graphical access to your device.

### Steam Deck: Sunshine

Stream your Deck's desktop to another device:

```yaml
install_remote_desktop: true
install_sunshine: true
```

Then connect with Moonlight from any device.

### ROG Ally: RDP

Enable Windows Remote Desktop:

```yaml
enable_rdp: true
```

Connect using any RDP client:

```
mstsc /v:192.168.1.101
```

### Cross-Platform Options

| Tool | Platforms | Best For |
|------|-----------|----------|
| **AnyDesk** | All | Easy setup, works everywhere |
| **RustDesk** | All | Open-source, self-hosted option |
| **Parsec** | All | Gaming-focused, low latency |

```yaml
# Enable on both platforms
install_anydesk: true
# or
install_rustdesk: true
```

---

## File Transfer

### SCP (SSH)

```bash
# Copy file to Steam Deck
scp game.rom deck@100.64.1.2:~/Emulation/roms/

# Copy from Steam Deck
scp deck@100.64.1.2:~/screenshot.png ./
```

### Rsync (SSH)

Better for large transfers or syncing:

```bash
# Sync ROMs folder
rsync -avz ~/ROMs/ deck@100.64.1.2:~/Emulation/roms/
```

### Windows Shared Folders

On ROG Ally, share a folder:

1. Right-click folder > Properties > Sharing
2. Enable sharing
3. Access from other Windows PCs via `\\hostname\share`

### Syncthing

Automatic file sync between devices (Steam Deck only):

```yaml
install_syncthing: true
```

Great for syncing save files, screenshots, or configs. On the ROG Ally, install Syncthing manually if needed.

---

## Wake on LAN

Wake your device remotely (if supported).

### Requirements

- Device connected via Ethernet (or WiFi with WoL support)
- BIOS/UEFI setting enabled
- MAC address of device

### Setup

1. Enable WoL in BIOS/UEFI
2. Note your device's MAC address
3. Use a WoL app or command to wake

### Using Tailscale for WoL

Tailscale doesn't support WoL directly, but you can:

1. Keep a low-power device always on (Raspberry Pi)
2. SSH to that device
3. Send WoL packet from there

---

## Security Considerations

### Network Exposure

| Method | Risk Level | Mitigation |
|--------|------------|------------|
| SSH (local only) | Low | Use keys, not passwords |
| SSH (port forwarded) | Medium | Change port, use fail2ban |
| Tailscale | Very Low | End-to-end encrypted |
| RDP (local only) | Low | Strong password |
| RDP (exposed) | High | Don't do this |

### Recommendations

1. **Use Tailscale** for remote access - no exposed ports
2. **Key-based SSH auth** - no passwords to guess
3. **Firewall rules** - limit what can connect
4. **Strong passwords** - if you must use password auth
5. **Regular updates** - keep Bootible and OS updated

---

## Quick Reference

#### Find Device IP

=== "Steam Deck"

    ```bash
    hostname -I
    ```

=== "ROG Ally"

    ```powershell
    ipconfig
    ```

#### Test SSH Connection

```bash
ssh -v user@hostname
```

#### Check Tailscale Status

```bash
tailscale status
```

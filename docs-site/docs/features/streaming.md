---
title: Game Streaming
description: Stream games between your PC, handhelds, and consoles
---

# Game Streaming

Stream games between your devices over your network—from PC to handheld, handheld to PC, or console to handheld.

---

## Overview

**Moonlight + Sunshine** is the recommended combo for PC streaming. Install both on all your devices and stream in any direction.

| Direction | Server (Host) | Client |
|-----------|---------------|--------|
| PC → Handheld | Sunshine (PC) | Moonlight (Handheld) |
| Handheld → PC | Sunshine (Handheld) | Moonlight (PC) |
| PlayStation → Any | PlayStation | Chiaki-ng |
| Xbox/Cloud → Any | Xbox/Cloud | Greenlight / Xbox App |

---

## Moonlight + Sunshine

The best option for streaming between your PC and handhelds. Works with **any GPU** (NVIDIA, AMD, Intel).

!!! tip "Bidirectional Streaming"
    Install Sunshine AND Moonlight on all your devices. This lets you stream in any direction—PC to handheld, handheld to PC, or even handheld to handheld.

### What You Need

| Device | Install |
|--------|---------|
| **Desktop/Laptop** | Sunshine + Moonlight (both manual) |
| **Steam Deck** | Sunshine + Moonlight (both via Bootible) |
| **ROG Ally** | Moonlight via Bootible (Sunshine manual, if hosting) |

### Setup: Sunshine (Host/Server)

Install Sunshine on any device you want to stream FROM:

=== "Desktop/Laptop"

    !!! info "Manual Install"
        Bootible doesn't configure desktops or laptops—install Sunshine manually.

    Sunshine works with **any GPU**—NVIDIA (NVENC), AMD (AMF), or Intel (QuickSync).

    1. Download from [Sunshine Releases](https://github.com/LizardByte/Sunshine/releases)
    2. Install the appropriate package for your OS
    3. Open web UI: `https://localhost:47990`
    4. Set up a username and password
    5. Add games to Sunshine (optional - can also stream full desktop)

    !!! note "NVIDIA GameStream is deprecated"
        Sunshine replaces NVIDIA GameStream, which was discontinued. Sunshine works with all GPUs and is actively maintained.

=== "Steam Deck"

    ```yaml
    install_sunshine: true
    ```

    After install, access web UI at `https://localhost:47990` to configure.

=== "ROG Ally"

    !!! info "Manual Install"
        Bootible doesn't install Sunshine on the Ally — in the usual setup the Ally is the **client** and Sunshine runs on your gaming PC. To stream *from* the Ally, install Sunshine manually from [Sunshine Releases](https://github.com/LizardByte/Sunshine/releases), then access the web UI at `https://localhost:47990`.

### Setup: Moonlight (Client)

Install Moonlight on any device you want to stream TO:

=== "Steam Deck"

    ```yaml
    install_moonlight: true
    ```

=== "ROG Ally"

    ```yaml
    install_moonlight: true
    ```

=== "Desktop/Laptop"

    !!! info "Manual Install"
        Bootible doesn't configure desktops or laptops—install Moonlight manually.

    Download from [moonlight-stream.org](https://moonlight-stream.org/)

### Pairing

1. Launch Moonlight on the client device
2. The host should appear automatically (if on same network)
3. Click on host, enter the PIN shown in Moonlight into Sunshine's web UI
4. Start streaming!

### Optimal Settings

| Setting | Recommended |
|---------|-------------|
| **Resolution** | Native (1280x800 Deck, 1920x1080 Ally) |
| **FPS** | 60 (or 120 if your PC/network supports it) |
| **Bitrate** | 20-50 Mbps for local, 10-20 for remote |
| **Codec** | HEVC (H.265) if supported |

### Troubleshooting

**Can't find PC?**

- Ensure both devices are on the same network
- Check Sunshine is running on PC
- Try entering PC's IP address manually

**High latency?**

- Use 5GHz WiFi or Ethernet
- Lower bitrate
- Disable VSync on host

**Poor quality?**

- Increase bitrate
- Ensure GPU encoding is working (not software)
- Check network bandwidth

---

## Parsec

Low-latency streaming that works with any GPU. Also great for remote desktop.

### Setup

=== "Steam Deck"

    ```yaml
    # Parsec via Flatpak (unofficial)
    # May need manual install
    ```

=== "ROG Ally"

    ```yaml
    install_parsec: true
    ```

### Pairing

1. Create Parsec account on both devices
2. Install Parsec on host PC and handheld
3. Connect to your PC from handheld's Parsec

### Parsec vs Moonlight

| Feature | Parsec | Moonlight |
|---------|--------|-----------|
| **Latency** | Excellent | Excellent |
| **GPU Support** | Any | Any (with Sunshine) |
| **Quality** | Great | Great |
| **Cost** | Free (personal) | Free |
| **Remote Access** | Built-in | Needs VPN |
| **Game Support** | Full desktop | Full desktop or games |

---

## Steam Link

Stream from any PC running Steam.

### Setup

=== "Steam Deck"

    Steam Link is built into Steam - use Remote Play.

=== "ROG Ally"

    ```yaml
    install_steam_link: true
    ```

### Pairing

1. Enable Remote Play in Steam settings on host PC
2. Both devices must be logged into the same Steam account
3. Your library shows "Stream" option for games on other PCs

### Best For

- Quick setup (no extra software on PC)
- Streaming Steam games
- Already have Steam on both devices

---

## PlayStation Remote Play (Chiaki-ng)

Stream your PlayStation 4 or 5 to your handheld.

### Setup

=== "Steam Deck"

    ```yaml
    install_chiaki: true  # Installs Chiaki4deck (optimized version)
    ```

=== "ROG Ally"

    ```yaml
    install_chiaki: true  # Installs Chiaki-ng
    ```

### Prerequisites

1. PlayStation 4 or 5
2. PSN account linked to console
3. Console on same network (or configured for remote access)

### Pairing

1. On PlayStation: **Settings > System > Remote Play** - Enable
2. On PlayStation: **Settings > System > Remote Play > Link Device** - Note the code
3. Launch Chiaki on handheld
4. Enter your PSN account ID and the linking code

### Getting Your PSN Account ID

You need your **Account ID** (not username). Use the [PSN Account ID Finder](https://psn.flipscreen.games/).

### Optimal Settings

| Setting | PS5 | PS4 |
|---------|-----|-----|
| **Resolution** | 1080p | 720p |
| **FPS** | 60 | 60 |
| **Bitrate** | 15000+ | 10000+ |

### Wake on LAN

Configure your PlayStation to wake up remotely:

1. On PlayStation: **Settings > System > Power Saving > Features Available in Rest Mode**
2. Enable **Stay Connected to the Internet**
3. Enable **Enable Turning on PS5 from Network**

Note your PlayStation's MAC address for wake configuration.

---

## Xbox Cloud Gaming

Stream Xbox games or Game Pass games.

### Setup

=== "Steam Deck"

    ```yaml
    install_greenlight: true
    ```

    Or use Edge browser with `xbox.com/play`.

=== "ROG Ally"

    ```yaml
    install_xbox_app: true
    ```

### Requirements

- Xbox Game Pass Ultimate subscription
- Microsoft account
- Good internet connection (15+ Mbps)

### Best For

- No gaming PC needed
- Access to Game Pass library anywhere
- Xbox console remote play

---

## Network Recommendations

### For Best Streaming Experience

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **WiFi** | 5GHz 802.11ac | WiFi 6 (802.11ax) |
| **Bandwidth** | 15 Mbps | 50+ Mbps |
| **Latency** | <50ms | <20ms |
| **Host Connection** | WiFi | Ethernet |

### Network Setup Tips

1. **Use 5GHz WiFi** - 2.4GHz has more interference
2. **Hardwire your host PC** - Reduces one wireless hop
3. **Same room/floor** - Minimizes WiFi distance
4. **Dedicated SSID** - Separate network for gaming if possible
5. **QoS** - Prioritize streaming traffic on router

### Remote Streaming (Outside Home)

For streaming outside your local network:

=== "Tailscale (Recommended)"

    ```yaml
    # On both devices
    install_tailscale: true
    ```

    Connect via Tailscale IP for encrypted tunnel.

=== "Port Forwarding"

    - Forward Sunshine port (47989/47984) on router
    - Less secure, more complex
    - May have NAT issues

---

## Comparison Table

| Feature | Moonlight + Sunshine | Parsec | Steam Link | Chiaki | Xbox Cloud |
|---------|----------------------|--------|------------|--------|------------|
| **Source** | Any device | PC | PC (Steam) | PlayStation | Cloud/Xbox |
| **Direction** | Bidirectional | Bidirectional | PC → Client | Console → Client | Cloud → Client |
| **GPU Support** | Any (NVIDIA, AMD, Intel) | Any | Any | N/A | N/A |
| **Latency** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Quality** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Setup** | Medium | Easy | Easy | Medium | Easy |
| **Cost** | Free | Free | Free | Free | Game Pass |
| **Remote** | VPN needed | Built-in | VPN needed | Possible | Built-in |

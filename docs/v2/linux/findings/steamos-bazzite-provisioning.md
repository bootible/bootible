---
description: What's actually possible when provisioning SteamOS and Bazzite handhelds, and what it means for bootible's two-model (USB-builder + on-device) approach.
tags: [linux, steamos, bazzite, provisioning, findings, steam-deck, rog-ally]
audience: { human: 55, agent: 45 }
purpose: { findings: 85, research: 15 }
---

# Findings: provisioning SteamOS & Bazzite

**The answer up front:** the **on-device script** model works cleanly on both distros and should be bootible's primary Linux path. The **image/USB-builder** model does **not** port over from Windows the way it looks: **SteamOS cannot be pre-seeded at all** (you can only flash Valve's unmodified image), and **Bazzite pre-seeding is a cloud CI build** (custom OCI image → ISO), not a desktop autounattend-style build — and its bare-metal `bootc` path is currently broken. So "same two models as the ROG" is true in spirit but the image model means something different on Linux.

Researched June 2026. Versions here are volatile — every concrete command/ID is flagged **verify** where it tends to drift. Sources are linked inline at the end.

---

## The two-model reality

| | **SteamOS 3** | **Bazzite** |
|---|---|---|
| **Pre-seed an image (desktop build)?** | ❌ No supported mechanism. Valve's recovery/installer image runs a fixed script; no `autounattend` equivalent. | ⚠️ Yes, but **in GitHub Actions/GHCR** (fork `image-template`, edit Containerfile → custom OCI image → Titanoboa ISO), not on Gavin's desktop. Bare-metal `bootc`/`bootc-image-builder` currently **broken** (issue #3418) — Titanoboa ISO is the working path. |
| **Flash stock OS from USB?** | ✅ Valve recovery image (`steamdeck-images.steamos.cloud/recovery/`) + 3.8 generic AMD installer (beta). | ✅ ISO from bazzite.gg (`bazzite-deck` for handhelds). |
| **On-device provision (script)?** | ✅ flatpak + Decky + EmuDeck + Distrobox/Nix/brew, run from Desktop Mode/SSH. | ✅ Same, plus **`ujust` recipes** (`setup-decky`, `setup-sunshine`, `install-emudeck`). |
| **Rebase in place (no USB)?** | ❌ | ✅ `rpm-ostree rebase …bazzite-deck:stable`. |

**Implication:** the universal, low-friction path is **flash stock OS → on-device script** — which also matches bootible's `deck.sh` heritage and the "minimal typing" rule. A true desktop-built pre-configured image is **Bazzite-only and cloud-built**; worth treating as a later, separate capability, not the v1 Linux path.

---

## How you persist software (the core constraint)

Both are immutable; **what you install and how decides whether it survives an OS update.**

**SteamOS** — read-only Btrfs root, A/B partitions; an update swaps to the *other* root and discards changes to the old one.
- ✅ Survives: **Flatpak** (home), **Distrobox**, **Nix** (`/nix`, since 3.5), **Homebrew** (`/home/linuxbrew`).
- ⚠️ `/etc` edits: must be added to `/etc/atomic-update.conf.d/` (SteamOS 3.6+) or they're wiped on update.
- ❌ **`pacman -S` is ephemeral** — wiped on every OS update. The #1 footgun.

**Bazzite** — Fedora Atomic / OSTree; `/usr` immutable, `/var` + `/home` persist.
- ✅ Survives: **Flatpak** (#1), **Homebrew** (#2), **Distrobox** (#3), `rpm-ostree install` (#4, "last resort" — adds update friction), **custom image** (best for system-level).
- ⚠️ `rpm-ostree usroverlay` is **transient** (gone on reboot) — never use it in a provisioning script expecting persistence.

**Shared takeaway:** lean on **Flatpak** for apps (fully scriptable, `flatpak install --assumeyes flathub <id>`, persists everywhere) and keep system-level changes minimal.

---

## The handheld payload — install paths

| Component | SteamOS | Bazzite | Headless? |
|---|---|---|---|
| **Decky Loader** | `curl … decky-installer … \| sh` | **`ujust setup-decky`** (applies the `bin_t` SELinux context — the raw curl installer fails on Bazzite) | mostly |
| **EmuDeck** | GUI installer / `curl … \| bash` | `ujust install-emudeck` (or curl) | ❌ Steam ROM Manager parse step needs UI |
| **Flatpak apps** | `flatpak install --assumeyes flathub <id>` | same | ✅ fully |
| **Sunshine (host)** | Flatpak (**verify** app ID — it has changed) + web-UI cred setup | **pre-installed**; `ujust setup-sunshine` → systemd daemon | ⚠️ first-run creds at :47990 |
| **Moonlight (client)** | `flatpak … com.moonlight_stream.Moonlight` | same | ✅ |
| **Non-Steam shortcuts** | edit `shortcuts.vdf` (no official CLI) | same | ❌ fiddly |

**Not fully zero-touch on Linux:** EmuDeck's Steam-shortcut step and Sunshine's first-run credentials both need UI. The Windows "never touch the device" promise is harder here — plan for a *guided* finish, not pure hands-off.

---

## Headless / parity niceties

- **SSH** — Bazzite: `systemctl enable --now sshd`, /etc persists, straightforward. SteamOS: `passwd` first (deck user has none), enable sshd, and allowlist `/etc/ssh` to survive updates (or run user-space sshd on :2022).
- **mDNS / `.local`** — Bazzite: works out of the box. **SteamOS: disabled by default** (Valve set `mdns=no` in NetworkManager) — a real gotcha for any beacon/discovery model; needs an allowlisted NM conf snippet.
- **Autologin to Gaming Mode** — Bazzite: drop `/etc/sddm.conf.d/autologin.conf` (session `gamescope-wayland`); default on `bazzite-deck`. SteamOS: via UI, not cleanly CLI-scriptable.
- **Beacon/announce** — neither ships one; a user-space systemd unit after `network-online.target` works on both (SteamOS unit must be allowlisted).

---

## Device topology

- **Steam Deck LCD vs OLED** — no software difference; same SteamOS image, same `bazzite-deck` image.
- **ROG Ally / Legion Go on Bazzite** — use `bazzite-deck`; **HHD (Handheld Daemon)** is bundled (gyro, TDP, RGB, controller emulation); `bazzite-hardware-setup` auto-applies kernel args (`amd_iommu=off`). Xbox Ally/Ally X supported since Bazzite 43.
- **ROG Ally on SteamOS 3.8** — generic installer is **AMD-only, beta**; third-party controller support still evolving; **no HHD** equivalent. Bazzite is the stronger Ally target today.
- **Secure Boot** — must be disabled (SteamOS) or have the Universal Blue MOK key enrolled (`ujust enroll-secure-boot-key`, password `universalblue`) for Bazzite.

---

## Footguns that would break a naive tool

- **SteamOS:** `pacman` wiped on update (G1); `steamos-readonly disable` fails if systemd-sysext merged (G2); sysext is version-tied + silently ignored after updates (G3); unallowlisted `/etc` edits vanish (G4); no image customization (G5); mDNS off (G6); Distrobox/Nix need ≥3.5 (G7); generic installer AMD-only beta (G8).
- **Bazzite:** `usroverlay` transient (G9); layering adds update friction (G10); **bare-metal `bootc` install broken — issue #3418** (G11); EmuDeck `ujust` recipe naming inconsistent (G12); raw Decky installer breaks on SELinux (G13); **`bazzite-deck` first boot requires a Steam login** (G14, headless caveat); Sunshine can't capture Gaming-Mode UI in some configs (G15); Secure Boot needs MOK enrollment (G16).

---

## Confirmed during the carrier spike (build requirements)

- **Reliable image fetch (RESOLVED — better than the store page):** `https://steamdeck-images.steamos.cloud/recovery/` is an **open directory index** (HTTP 200; lists every image + size + date). bootible GETs it, parses the listing, picks the **newest by date** — no fragile, EULA-gated store-page scraping (which serves a sometimes-lagging "repair" image anyway). Naming evolved `steamdeck-recovery-N` → `steamdeck-repair-DATE` → `steamdeck-oobe-repair-DATE.VER`, so match by recency, not a hardcoded name. Latest at research time: `steamdeck-oobe-repair-20260618.10-3.8.10.img.zip` (3.8.10).
- **Fetch the `.img.zip`, NOT the `.img.bz2`.** Every image is published in both. **Windows decompresses zip natively** (Expand-Archive / .NET ZipFile) — so the bz2 problem disappears. Pipeline: download `.img.zip` → native unzip → raw-flash `.img` → append `BOOTIBLE`. (bz2 only bit us when forced onto the .bz2; the .zip sidesteps it — no extra dependency.)
- **No separate installer / no prior reset needed:** this recovery image *is* the Deck OS install (boot USB → "Reimage Device" → fresh SteamOS). bootible owns the whole build; the user doesn't pre-factory-reset.
- **Carrier mechanism (✅ VALIDATED on a real Steam Deck, 28 Jun 2026):** append an **exFAT** partition in the free space after the flashed recovery image, carrying the payload. Proven readable **and executable** (`bash …/verify.sh` ran) from **both** the SteamOS **recovery desktop** and **installed SteamOS** (Desktop Mode). Specifics:
  - **exFAT works even in the minimal recovery env** — no FAT32 fallback needed (keeps the no-4 GB-file-limit benefit).
  - **Volume label ≤ 11 chars** (FAT/exFAT limit; `BOOTIBLE-DATA` was rejected). **Standardize on label `BOOTIBLE`**; the on-device script finds the partition by that label.
  - Append happens *after* the flash; Windows partition-create needs an **elevated** context (`diskpart`/Storage cmdlets fail non-elevated). Disk Management GUI offers exFAT at full size but FAT32 only ≤32 GB → the app will use elevated `diskpart`.
  - **SteamOS partition layout confirmed:** `nvme0n1` p1–p3 esp/efi (vfat), p4/p5 `rootfs` (btrfs, A/B), p6/p7 `var-A`/`var-B` (ext4), p8 `home` (ext4) — useful for the later inject/firstboot path (discover by label, not node).

## Open questions (need verification before design locks)

1. **SteamOS 3.8 generic (non-Deck) installer** — partition scheme and whether it offers the Deck image's four recovery options (the spike uses the Deck recovery image; the generic AMD installer may differ).
2. **ROG Ally controller support on SteamOS 3.8** — is there an HHD equivalent in the generic image, or is Bazzite the only good Ally path?
3. **Decky persistence across a SteamOS A/B update** — does the user-space service re-register without a re-run?
4. **Sunshine Flatpak app ID** — verify current ID on Flathub before hardcoding.
5. **Fully non-interactive EmuDeck** — no evidence one exists on either distro; the ROM-manager step appears to require UI.

---

## What this means for the declaration chain

The findings surface one decision that shapes everything downstream, for the **north star / flows** to resolve with Gavin:

- **Primary Linux model = on-device script** (flash stock OS → `curl|bash` / `ujust`), reusing the `DeviceProfile` seam (catalog + bundles + executor) with a Linux executor. This is achievable, shared across both distros, and on-brand.
- **Image-builder for Linux is a different beast** than the Windows autounattend USB: SteamOS = impossible; Bazzite = a cloud CI custom-image pipeline. Treat as a **later, Bazzite-only** capability, not v1.
- **"Zero-touch" likely becomes "guided finish" on Linux** — EmuDeck + Sunshine creds + (Bazzite) first-boot Steam login need a human. The north star should state the honest outcome.

Sources: SteamOS persistence — [Igalia /etc](https://blogs.igalia.com/berto/2025/02/05/keeping-your-system-wide-configuration-files-intact-after-updating-steamos/), [Igalia Distrobox/Nix](https://blogs.igalia.com/berto/2024/06/05/more-ways-to-install-software-in-steamos-distrobox-and-nix/), [Collabora 3.6 atomic](https://www.collabora.com/news-and-blog/news-and-events/steamos-3-6-how-the-steam-deck-atomic-updates-are-improving.html), [iliana custom updates](https://iliana.fyi/blog/build-your-own-steamos-updates/); recovery/installer — [Valve repair](https://help.steampowered.com/en/faqs/view/65B4-2AA3-5F37-4227), [SteamOS 3.8 generic](https://www.thesixthaxis.com/2026/06/22/you-can-now-install-steamos-3-8-on-your-standard-gaming-pc-with-amd-gpu/); Bazzite — [image variants](https://deepwiki.com/ublue-os/bazzite/1.1-image-variants), [package layering](https://deepwiki.com/bazzite-org/docs.bazzite.gg/7.4-system-level-package-management), [ISO/Titanoboa](https://deepwiki.com/ublue-os/bazzite/2.6-iso-build-and-distribution), [image-template](https://github.com/ublue-os/image-template), [bootc broken #3418](https://github.com/ublue-os/bazzite/issues/3418), [Decky/SELinux](https://deepwiki.com/ublue-os/bazzite/7.6-decky-loader-plugin-system), [HHD/handhelds](https://deepwiki.com/ublue-os/bazzite/8.4-handheld-device-support); payload — [Decky](https://decky.xyz/), [EmuDeck Linux](https://emudeck.github.io/how-to-install-emudeck/linux/), [Bazzite headless streaming](https://aalonso.dev/blog/2026/how-to-configure-bazzite-as-a-headless-streaming-gaming-pc/).

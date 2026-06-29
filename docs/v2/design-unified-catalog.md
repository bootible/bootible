---
description: One platform-agnostic app/emulator/streaming catalog that drives both the Windows (winget) and Steam Deck (Flatpak) pickers, so parity is structural instead of hand-maintained.
tags: [catalog, parity, apps, emulators, streaming, deck, windows]
audience: { human: 60, agent: 40 }
purpose: { design: 80, findings: 20 }
---

# Unified device catalog

**Problem (verified today):** apps for Windows live in `apps.ts` (winget) and apps for the Deck live in `deck-apps.ts` (Flatpak). They are **separate lists maintained by hand, and they have drifted**:

| Gap | Windows | Deck |
|-----|---------|------|
| Browsers | Firefox / Chrome / Opera | Firefox / **Chromium** (no Chrome, no Opera) |
| Media | VLC / Spotify / Apple Music | VLC / Spotify / **Plex / Jellyfin** |
| Emulators | a group: EmuDeck + RetroArch / ES-DE / Dolphin / PCSX2 / PPSSPP / DuckStation | **just an EmuDeck on/off toggle** — no individual emulators |
| Streaming | a group + a real Sunshine setup (web-UI user/password, "also install on this PC") | **a bare Sunshine toggle** + Moonlight/Chiaki scattered as apps; no credentials |

Layout can't fix this. The two catalogs will keep diverging as long as they are two catalogs.

## North star — what "done" means (testable)

> 1. There is **one catalog entry per app**, keyed by a stable `id`, that carries how it installs on **each** platform it supports.
> 2. Adding an app **once** makes it appear on **every** platform that can run it — no second edit in a second file.
> 3. Each device's picker is **derived** from that catalog filtered to the platform; the Windows and Deck pickers render from the **same** data with the **same** grouping.
> 4. **Emulators** and **Streaming** are first-class shared groups, not a Windows-only section + a Deck toggle.
> 5. A reviewer can answer "is app X available on the Deck?" by reading **one** entry, not by diffing two files.

## The model

One platform-agnostic entry. **Presence of an install method = availability on that platform** (the core idea — no separate "platforms" flag to keep in sync):

```ts
interface CatalogApp {
  id: string;                       // stable slug shared across platforms (e.g. "chrome")
  name: string;
  category: AppCategory;            // Browser | Media | Communication | Launcher
                                    // | Streaming | Emulator | Productivity | Utility | …
  desc?: string;
  recommended?: boolean;            // pre-ticked when its group is enabled

  // Install methods — having one means "runs on that platform":
  winget?: { id: string; source?: "winget" | "msstore" };  // → Windows
  flatpak?: string;                                          // → SteamOS
  module?: string;   // a bootible manager/module instead of a single package (e.g. EmuDeck),
                     // resolved per-platform by the executor/provision script
}
```

- **`windowsApps()`** = entries with a `winget` (or a Windows `module`). **`deckApps()`** = entries with a `flatpak` (or a Deck `module`). Both are pure derivations of `CATALOG`.
- **Selection is by `id`.** A build resolves each chosen id to the right install method for that device — winget on Windows, `flatpak install` on the Deck.
- **Linux-only / Windows-only fall out naturally:** RetroDeck has only a `flatpak` → Deck-only; Apple Music has only an `msstore` winget → Windows-only. No flag needed.

### Worked examples

| id | winget | flatpak | Shows on |
|----|--------|---------|----------|
| `chrome` | `Google.Chrome` | `com.google.Chrome` | both |
| `opera` | `Opera.Opera` | `com.opera.Opera` | both |
| `plex` | *(verify)* | `tv.plex.PlexDesktop` | both (once winget id confirmed) |
| `retroarch` | `Libretro.RetroArch` | `org.libretro.RetroArch` | both |
| `retrodeck` | — | `net.retrodeck.retrodeck` | Deck only |
| `emudeck` | `module: emudeck` | `module: emudeck` | both (manager, not a package) |

*(All Flatpak refs above verified live on Flathub; ES-DE left Flathub in 2024 → RetroDeck is the Linux all-in-one.)*

### Emulators & Streaming become shared groups

- **Emulator** category: EmuDeck (manager) + RetroDeck (Deck-only manager) + RetroArch / Dolphin / PCSX2 / PPSSPP / DuckStation (individual, both platforms). Same grouped picker both sides.
- **Streaming** category + a shared **Sunshine setup**: promote `DeckConfig.sunshine` from `boolean` to the same shape the Windows side already collects — `{ enabled, user?, pass? }` — and the Deck provision pre-sets the Sunshine web-UI credentials, matching ROG.

## Migration — incremental, no big-bang

1. **Define `CatalogApp` + one `CATALOG`** (id-keyed), merging today's two lists. Preserve every existing id. Each entry gets its `winget` and/or `flatpak`.
2. **Keep the old shapes as derived views** — `APP_GROUPS` (Windows) and `FLATPAK_APPS` (Deck) become thin selectors over `CATALOG`, so neither renderer breaks while we migrate. Tests stay green.
3. **Close the gaps in `CATALOG`**: Chrome + Opera flatpak refs; Plex + Jellyfin winget ids; the emulator entries (both refs); the streaming group.
4. **Unify the pickers**: both devices use the grouped, category-collapsible picker (the ROG `.app-group` style the Deck now reuses). Deck gains an Emulators group; Windows gains Plex/Jellyfin.
5. **Shared Sunshine setup** + retire the bare Deck `sunshine` boolean.
6. **Delete the derived-view shims** once both renderers read `CATALOG` directly.

Each step ships independently and keeps the gate green.

## Decisions (agreed)

- **Browsers:** Chrome **replaces** Chromium on the Deck → both sides offer Firefox / Chrome / Opera.
- **Emulator managers:** offer **both EmuDeck (pre-ticked default) and RetroDeck (Deck-only)**, plus individual emulators (RetroArch / Dolphin / PCSX2 / PPSSPP / DuckStation).
- **Scope:** unify the **entire** catalog into the model now (one `CATALOG`), not just the drifted groups.
- **Taxonomy:** one shared category set across both devices (merge "Launcher"/"Game launchers", etc.).

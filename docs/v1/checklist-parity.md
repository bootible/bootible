# Community Checklist Parity

This table maps bootible's ROG Ally coverage against the converged "new Windows handheld" community checklist — the steps that the XDA starter guide, HowToGeek's 20 tips, the baldsealion guide, and ASUS's official guidance agree a new owner should do first. Sources and convergence analysis live in [research/handheld-community-landscape.md](research/handheld-community-landscape.md). Coverage was verified against the module code, not just config keys: **Covered** means the module demonstrably performs the step, **Partial** means part of the step is automated, **Not covered** means bootible does not do it (sometimes deliberately — see Notes).

| # | Checklist item | bootible coverage | Config key(s) | Notes |
|---|----------------|-------------------|---------------|-------|
| 1 | Debloat Windows (remove preinstalled apps/ads) | Partial | `install_debloat`, `disable_tips`, `disable_lockscreen_junk`, `disable_bing_search`, `disable_copilot`, `debloat_edge`, `set_services_manual` | Ads, tips, lock-screen junk, Bing/Copilot, and Edge bloat are disabled via registry; preinstalled Store (Appx) apps are not removed — see Deferred. |
| 2 | Switch sleep to hibernate | Covered | `sleep_mode`, `hibernate_after_minutes`, `power_button_action` | `modules/power.ps1` disables standby timeouts, enables hibernate, and optionally remaps the power button via `powercfg`. |
| 3 | Install G-Helper (Armoury Crate alternative) | Covered | `install_ghelper` | `modules/rog_ally.ps1` installs the latest G-Helper from GitHub releases. Opt-in (default `false`); Armoury Crate remains the default path. |
| 4 | Configure TDP / performance profiles | Not covered | — | TDP profiles are owned by G-Helper/Armoury Crate at runtime — bootible installs the tool, it doesn't manage live profiles. `configure_power_plans` only prints guidance pointing at Armoury Crate. |
| 5 | Disable CPU boost for battery | Covered | `disable_cpu_boost_on_battery` | `modules/power.ps1` sets `PERFBOOSTMODE 0` on the DC (battery) setting of the active scheme only; plugged-in performance is untouched. Opt-in (default `false`). |
| 6 | Set display refresh rate | Covered | `set_refresh_rate` | Shipped in the v1.1 display module — `modules/display.ps1` applies the rate via Win32 `ChangeDisplaySettingsEx`, validated against panel-supported modes. |
| 7 | Configure HDR | Covered | `configure_hdr` | Shipped in the v1.1 display module — HDR toggled via HDRCmd (res2k/HDRTray), auto-downloaded on first use. |
| 8 | Install game launchers (Steam, Epic, GOG, etc.) | Covered | `install_steam`, `install_gog_galaxy`, `install_epic_launcher`, `install_ea_app`, `install_ubisoft_connect`, `install_battle_net`, `install_amazon_games`, `install_playnite` | `modules/gaming.ps1` installs each enabled launcher via winget (Battle.net has a dedicated direct-download path). |
| 9 | Install streaming clients (Moonlight/Chiaki) | Covered | `install_moonlight`, `install_chiaki`, `install_parsec`, `install_steam_link`, `install_greenlight`, `install_xbox_app`, `install_geforcenow` | `modules/streaming.ps1` installs each enabled client. |
| 10 | Set up emulation (EmuDeck) | Partial | `install_emulation` | `modules/emulation.ps1` launches the EmuDeck installer (EA build from the private repo if present, otherwise public); emulator selection and ROM paths remain interactive inside EmuDeck. The per-emulator keys (`install_emudeck`, `install_retroarch`, etc.) were removed in the v1.1 dead-key purge - EmuDeck owns emulator installs (EmuDeck-only reconfirmed by automation research - see docs/docs-persona-review.md). |
| 11 | Enable Storage Sense / free disk space | Covered | `enable_storage_sense`, `run_disk_cleanup` | `modules/optimization.ps1` enables Storage Sense via the StoragePolicy registry key and can run a flagged `cleanmgr` pass. |
| 12 | Privacy/telemetry tweaks | Covered | `disable_telemetry`, `disable_activity_history`, `disable_location_tracking`, `disable_copilot`, `disable_powershell7_telemetry` | `modules/debloat.ps1` applies each tweak via registry (UCPD-protected keys are scheduled for next logon). |
| 13 | Update GPU drivers + guard Windows Update regressions | Partial | — | `modules/base.ps1` reports pending Windows updates informationally. The drift guard detects GPU driver version changes between runs and reports them (report-only — no driver updates, no rollback), and re-running `bootible` re-applies settings an update reverted. That is detection + repair, not prevention; update pausing/driver pinning is not covered. See Deferred. |
| 14 | Remote access (SSH/Tailscale/RDP) | Covered | `install_remote_access`, `install_tailscale`, `install_anydesk`, `install_rustdesk`, `enable_rdp`, `install_ssh`, `ssh_server_enable` | `modules/remote_access.ps1` installs clients and enables RDP (registry + firewall rule); `modules/ssh.ps1` handles OpenSSH server and key setup. All opt-in (default `false`). |

**Summary: 10 Covered, 3 Partial, 1 Not covered** (TDP profiles — a deliberate non-goal, not a gap).

## Deferred

Genuine gaps that are too large to close in this pass:

- **Preinstalled app (Appx) removal** — needs a curated, per-Windows-build safe-list so removals don't break Store/Xbox/Game Pass dependencies that handhelds rely on, plus an undo story.
- **Windows Update pausing / driver pinning** — GPU driver version changes are now detected and reported by the drift guard that shipped with the state-snapshot work (report-only — no rollback). What remains deferred is prevention: an update-policy module that can pause/defer Windows Update and pin a known-good driver version.
- **G-Helper updates** — installed once, never auto-updated; a deliberate `-Force` update path is future work.
- **SSH key management** — SSH key generation/GitHub upload keys removed in v1.1 - the January 2026 "server only" simplification deliberately cut an unreliable implementation; planned to return as a properly spec'd feature.
- **ReShade** — `install_reshade` removed - ReShade is per-game DLL injection; a global install key has no implementable meaning on Windows.
- **Cortana** — `disable_cortana` removed - Windows 11 24H2 removed Cortana from the OS; there is nothing to disable.

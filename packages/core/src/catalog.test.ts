import { describe, expect, it } from "vitest";
import { CATALOG, catalogApp, deckCatalog, windowsCatalog } from "./catalog";

describe("CATALOG", () => {
  it("has unique ids", () => {
    const ids = CATALOG.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry installs somehow (winget, flatpak or module)", () => {
    for (const a of CATALOG) {
      expect(Boolean(a.winget || a.flatpak || a.module), `${a.id} has no install method`).toBe(
        true,
      );
    }
  });

  it("derives a Windows view (winget/module) and a Deck view (flatpak/module)", () => {
    const win = new Set(windowsCatalog().map((a) => a.id));
    const deck = new Set(deckCatalog().map((a) => a.id));
    // Windows-only
    expect(win.has("powertoys")).toBe(true);
    expect(deck.has("powertoys")).toBe(false);
    // Deck-only
    expect(deck.has("retrodeck")).toBe(true);
    expect(win.has("retrodeck")).toBe(false);
    expect(deck.has("heroic")).toBe(true);
    expect(win.has("heroic")).toBe(false);
    // module apps (EmuDeck) appear on both
    expect(win.has("emudeck")).toBe(true);
    expect(deck.has("emudeck")).toBe(true);
  });

  it("closes the parity gaps the design called out", () => {
    // Chrome replaces Chromium, on both platforms; Opera on both
    expect(catalogApp("chromium")).toBeUndefined();
    for (const id of ["chrome", "opera"]) {
      const a = catalogApp(id);
      expect(a?.winget, `${id} winget`).toBeTruthy();
      expect(a?.flatpak, `${id} flatpak`).toBeTruthy();
    }
    // Plex + Jellyfin now on Windows too
    expect(catalogApp("plex")?.winget).toBeTruthy();
    expect(catalogApp("jellyfin")?.winget).toBeTruthy();
    // Individual emulators reach the Deck (flatpak)
    for (const id of ["retroarch", "dolphin", "pcsx2", "ppsspp", "duckstation"]) {
      expect(catalogApp(id)?.flatpak, `${id} flatpak`).toBeTruthy();
    }
  });
});

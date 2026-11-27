import { DISPLAY_LANGUAGES, type IsoOption } from "@bootible/core";
import { type BrowserWindow, dialog } from "electron";

// The Rufus-style ISO dropdown, derived from the display-language catalog so the
// download language and the answer-file UI language are one and the same choice
// (no mismatch → no Windows Setup language prompt). Fido resolves the real
// Microsoft URL from rel/ed/lang/arch at download time; -Rel "Latest" is the
// only release it serves (older versions like 24H2 are rejected), so for a
// specific version the user browses to a local ISO instead.
export const ISO_CATALOG = DISPLAY_LANGUAGES.map((l) => ({
  id: `win11-latest-${l.id}`,
  label: `Windows 11 (latest) — ${l.label} (x64)`,
  rel: "Latest",
  ed: "Home/Pro",
  lang: l.fidoLang,
  arch: "x64",
  uiLanguage: l.uiLanguage,
}));

export function getIsoCatalog(): IsoOption[] {
  return ISO_CATALOG.map((o) => ({ id: o.id, label: o.label }));
}

/** Let the user pick a local Windows ISO. Returns the path, or null. */
export async function browseIso(win: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(win, {
    title: "Choose a Windows 11 ISO",
    properties: ["openFile"],
    filters: [{ name: "ISO", extensions: ["iso"] }],
  });
  return result.canceled || !result.filePaths[0] ? null : result.filePaths[0];
}

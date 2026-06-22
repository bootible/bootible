import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISPLAY_LANGUAGE_ID,
  DEFAULT_KEYBOARD_REGION_ID,
  DISPLAY_LANGUAGES,
  defaultDisplayLanguage,
  defaultKeyboardRegion,
  displayLanguageById,
  KEYBOARD_REGIONS,
  keyboardRegionById,
} from "./languages";

describe("display language catalog", () => {
  it("couples every download language to a non-empty UI tag (the no-mismatch guarantee)", () => {
    for (const lang of DISPLAY_LANGUAGES) {
      expect(lang.fidoLang.length).toBeGreaterThan(0);
      expect(lang.uiLanguage).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });

  it("uses unique ids", () => {
    expect(new Set(DISPLAY_LANGUAGES.map((l) => l.id)).size).toBe(DISPLAY_LANGUAGES.length);
  });

  it("keeps Microsoft's English labelling exact (English=en-US, English International=en-GB)", () => {
    expect(displayLanguageById("en-us")).toMatchObject({
      fidoLang: "English",
      uiLanguage: "en-US",
    });
    expect(displayLanguageById("en-intl")).toMatchObject({
      fidoLang: "English International",
      uiLanguage: "en-GB",
    });
  });

  it("resolves a present default", () => {
    expect(defaultDisplayLanguage().id).toBe(DEFAULT_DISPLAY_LANGUAGE_ID);
    expect(displayLanguageById("nope")).toBeUndefined();
  });
});

describe("keyboard/region catalog", () => {
  it("gives every region a BCP-47 locale", () => {
    for (const region of KEYBOARD_REGIONS) {
      expect(region.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });

  it("uses unique ids and resolves a present default (New Zealand)", () => {
    expect(new Set(KEYBOARD_REGIONS.map((r) => r.id)).size).toBe(KEYBOARD_REGIONS.length);
    expect(defaultKeyboardRegion().id).toBe(DEFAULT_KEYBOARD_REGION_ID);
    expect(keyboardRegionById("en-NZ")?.locale).toBe("en-NZ");
  });
});

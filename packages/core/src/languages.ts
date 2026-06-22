// The set of Windows display languages and region/keyboard locales bootible can
// install — and, crucially, the coupling between them.
//
// The #1 cause of the Windows Setup language/keyboard prompt appearing is a
// mismatch between the answer file's <UILanguage> and the UI language of the
// ISO being installed (Setup can't apply a UI language the image lacks, so it
// falls back to asking). bootible removes that whole class of bug by treating
// the *download language* and the *answer-file UI language* as one choice: a
// DisplayLanguage carries both the Fido download label AND the BCP-47 UI tag,
// so they can never disagree. See autounattend.ts and prepare-usb.ps1 ($IsoLang).

/**
 * A Windows display language bootible can install. `fidoLang` is the exact label
 * Fido/Microsoft use for the download; `uiLanguage` is the BCP-47 tag that label
 * resolves to — the value the answer file's <UILanguage> MUST use to match.
 *
 * Note Microsoft's labelling quirk: "English" is en-US, "English International"
 * is en-GB. Each pair below is exact; do not guess new ones — an inexact label
 * fails the Fido download and an inexact tag re-introduces the prompt.
 */
export interface DisplayLanguage {
  id: string;
  label: string;
  fidoLang: string;
  uiLanguage: string;
}

/** Region + keyboard layout. Drives InputLocale/SystemLocale/UserLocale; the
 *  BCP-47 locale selects the region's default keyboard. Independent of the
 *  display language (e.g. an en-GB display with an en-NZ keyboard/region). */
export interface KeyboardRegion {
  id: string;
  label: string;
  locale: string;
}

/** The default display language — a named const so it's statically known to be
 *  present (no index-access undefined). English International image = en-GB UI. */
const EN_INTERNATIONAL: DisplayLanguage = {
  id: "en-intl",
  label: "English (International)",
  fidoLang: "English International",
  uiLanguage: "en-GB",
};

/** Display languages, mirroring Fido's Windows 11 -Lang options. Curated to the
 *  pairs that are verified exact; extend only with confirmed fidoLang/uiLanguage. */
export const DISPLAY_LANGUAGES: DisplayLanguage[] = [
  EN_INTERNATIONAL,
  { id: "en-us", label: "English (United States)", fidoLang: "English", uiLanguage: "en-US" },
  { id: "fr", label: "French", fidoLang: "French", uiLanguage: "fr-FR" },
  { id: "fr-ca", label: "French (Canadian)", fidoLang: "French Canadian", uiLanguage: "fr-CA" },
  { id: "de", label: "German", fidoLang: "German", uiLanguage: "de-DE" },
  { id: "it", label: "Italian", fidoLang: "Italian", uiLanguage: "it-IT" },
  { id: "es", label: "Spanish", fidoLang: "Spanish", uiLanguage: "es-ES" },
  { id: "es-mx", label: "Spanish (Mexico)", fidoLang: "Spanish (Mexico)", uiLanguage: "es-MX" },
  { id: "nl", label: "Dutch", fidoLang: "Dutch", uiLanguage: "nl-NL" },
  { id: "pt", label: "Portuguese", fidoLang: "Portuguese", uiLanguage: "pt-PT" },
  {
    id: "pt-br",
    label: "Portuguese (Brazil)",
    fidoLang: "Brazilian Portuguese",
    uiLanguage: "pt-BR",
  },
  { id: "sv", label: "Swedish", fidoLang: "Swedish", uiLanguage: "sv-SE" },
  { id: "da", label: "Danish", fidoLang: "Danish", uiLanguage: "da-DK" },
  { id: "fi", label: "Finnish", fidoLang: "Finnish", uiLanguage: "fi-FI" },
  { id: "nb", label: "Norwegian", fidoLang: "Norwegian", uiLanguage: "nb-NO" },
  { id: "pl", label: "Polish", fidoLang: "Polish", uiLanguage: "pl-PL" },
  { id: "cs", label: "Czech", fidoLang: "Czech", uiLanguage: "cs-CZ" },
  { id: "tr", label: "Turkish", fidoLang: "Turkish", uiLanguage: "tr-TR" },
  { id: "ru", label: "Russian", fidoLang: "Russian", uiLanguage: "ru-RU" },
  { id: "ja", label: "Japanese", fidoLang: "Japanese", uiLanguage: "ja-JP" },
  { id: "ko", label: "Korean", fidoLang: "Korean", uiLanguage: "ko-KR" },
  {
    id: "zh-cn",
    label: "Chinese (Simplified)",
    fidoLang: "Chinese (Simplified)",
    uiLanguage: "zh-CN",
  },
  {
    id: "zh-tw",
    label: "Chinese (Traditional)",
    fidoLang: "Chinese (Traditional)",
    uiLanguage: "zh-TW",
  },
];

/** The default region/keyboard — named const so it's statically known present. */
const NEW_ZEALAND: KeyboardRegion = { id: "en-NZ", label: "New Zealand", locale: "en-NZ" };

/** Region/keyboard locales. English-speaking regions first (bootible's audience),
 *  then majors. Each locale selects that region's default keyboard layout. */
export const KEYBOARD_REGIONS: KeyboardRegion[] = [
  NEW_ZEALAND,
  { id: "en-AU", label: "Australia", locale: "en-AU" },
  { id: "en-GB", label: "United Kingdom", locale: "en-GB" },
  { id: "en-US", label: "United States", locale: "en-US" },
  { id: "en-CA", label: "Canada (English)", locale: "en-CA" },
  { id: "en-IE", label: "Ireland", locale: "en-IE" },
  { id: "fr-FR", label: "France", locale: "fr-FR" },
  { id: "fr-CA", label: "Canada (French)", locale: "fr-CA" },
  { id: "de-DE", label: "Germany", locale: "de-DE" },
  { id: "it-IT", label: "Italy", locale: "it-IT" },
  { id: "es-ES", label: "Spain", locale: "es-ES" },
  { id: "nl-NL", label: "Netherlands", locale: "nl-NL" },
  { id: "sv-SE", label: "Sweden", locale: "sv-SE" },
  { id: "da-DK", label: "Denmark", locale: "da-DK" },
  { id: "fi-FI", label: "Finland", locale: "fi-FI" },
  { id: "nb-NO", label: "Norway", locale: "nb-NO" },
  { id: "pl-PL", label: "Poland", locale: "pl-PL" },
  { id: "pt-BR", label: "Brazil", locale: "pt-BR" },
  { id: "ja-JP", label: "Japan", locale: "ja-JP" },
  { id: "ko-KR", label: "Korea", locale: "ko-KR" },
  { id: "zh-CN", label: "China", locale: "zh-CN" },
];

/** Defaults — English International image with a New Zealand keyboard/region,
 *  bootible's home configuration (and a valid, matched pair). */
export const DEFAULT_DISPLAY_LANGUAGE_ID = "en-intl";
export const DEFAULT_KEYBOARD_REGION_ID = "en-NZ";

export function displayLanguageById(id: string | undefined): DisplayLanguage | undefined {
  return DISPLAY_LANGUAGES.find((l) => l.id === id);
}

export function keyboardRegionById(id: string | undefined): KeyboardRegion | undefined {
  return KEYBOARD_REGIONS.find((r) => r.id === id);
}

/** The default display language entry (statically guaranteed present). */
export function defaultDisplayLanguage(): DisplayLanguage {
  return EN_INTERNATIONAL;
}

/** The default region entry (statically guaranteed present). */
export function defaultKeyboardRegion(): KeyboardRegion {
  return NEW_ZEALAND;
}

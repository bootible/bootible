// Browser-safe value exports.
//
// The renderer can `import type` from the main barrel ("@bootible/core") freely —
// types erase — but a VALUE import of the barrel pulls Node-only modules (fs/path,
// via autounattend / bootstrap / deck-provision) into the renderer bundle, which
// the browser can't include. This subpath ("@bootible/core/browser") re-exports
// only pure-data modules whose full import graph is Node-free, so the renderer can
// value-import shared defaults instead of hand-duplicating them (coding-standard #8).
//
// Add a module here only after confirming its transitive imports use no `node:`
// builtins — the renderer build (electron-vite) fails loudly if one slips through.

export type { CatalogApp } from "./catalog";
export { browserApps, catalogApp } from "./catalog";
export { RECOMMENDED_DECKY_PLUGINS } from "./deck-apps";
export { DEFAULT_DECK_CONFIG } from "./deck-config";
export type { DeviceCapabilities, MediaMode, NetworkCapability } from "./device-capabilities";
export { capabilitiesFor, devicesWithCapabilities } from "./device-capabilities";

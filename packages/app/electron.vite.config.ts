import { defineConfig, externalizeDepsPlugin } from "electron-vite";

// @bootible/core exports raw TypeScript (exports -> ./src/index.ts), so it must
// be BUNDLED into the main/preload output rather than externalized — Electron
// can't require a .ts file. Its transitive npm deps (ajv, yaml) get bundled in
// alongside it; electron and node:* stay external. The plugin only externalizes
// the app's own declared dependencies, so excluding core pulls it into the bundle.
const bundleCore = externalizeDepsPlugin({ exclude: ["@bootible/core"] });

// Bake the API base when BOOTIBLE_API_BASE is set at BUILD time (e.g. a staging
// build); otherwise leave the runtime `process.env.BOOTIBLE_API_BASE ?? prod`
// lookup in cloud.ts intact so a normal build defaults to production.
const apiBase = process.env.BOOTIBLE_API_BASE;
const apiDefine = apiBase
  ? { "process.env.BOOTIBLE_API_BASE": JSON.stringify(apiBase) }
  : undefined;

export default defineConfig({
  main: { plugins: [bundleCore], define: apiDefine },
  preload: { plugins: [bundleCore] },
  renderer: {},
});

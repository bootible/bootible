import { defineConfig, externalizeDepsPlugin } from "electron-vite";

// @bootible/core exports raw TypeScript (exports -> ./src/index.ts), so it must
// be BUNDLED into the main/preload output rather than externalized — Electron
// can't require a .ts file. Its transitive npm deps (ajv, yaml) get bundled in
// alongside it; electron and node:* stay external. The plugin only externalizes
// the app's own declared dependencies, so excluding core pulls it into the bundle.
const bundleCore = externalizeDepsPlugin({ exclude: ["@bootible/core"] });

export default defineConfig({
  main: { plugins: [bundleCore] },
  preload: { plugins: [bundleCore] },
  renderer: {},
});

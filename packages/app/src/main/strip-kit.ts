import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import {
  buildConfig,
  buildSettings,
  chosenKeys,
  generateStripLauncher,
  generateStripReadme,
  generateStripScript,
  resolveModules,
  type UsbBuildRequest,
} from "@bootible/core";
import { lastBuild, sanitizeHostname } from "./build-state";
import { targetDevice } from "./registry";
import { identityForKeys } from "./ssh";

/** The three Full ROG strip-kit files, generated from the user's config (their
 *  picked apps + SSH baked in). */
function buildStripKit(req: UsbBuildRequest): { name: string; content: string; bom: boolean }[] {
  const device = targetDevice();
  const modules = resolveModules(req);
  // A build token so the device's end-of-strip beacon is recognised as "mine" on
  // the desktop's discover screen; plus the SSH details for Verify.
  lastBuild.id = randomBytes(6).toString("hex");
  lastBuild.username = req.account?.username || "ally";
  lastBuild.hostname = sanitizeHostname(req.hostname);
  lastBuild.identity = identityForKeys(chosenKeys(req));
  const config = buildConfig({
    device: device?.id ?? "rog-ally",
    modules: modules.length ? modules : undefined,
    settings: { ...buildSettings(req), build_id: lastBuild.id },
  });
  return [
    { name: "bootible.ps1", content: generateStripScript(config), bom: true },
    { name: "bootible.bat", content: generateStripLauncher(), bom: false },
    { name: "README-restore.txt", content: generateStripReadme(), bom: false },
  ];
}

/** Write the strip kit into a target folder (a disk folder or a USB drive root). */
export function writeStripKit(folder: string, req: UsbBuildRequest): void {
  // Don't mkdir a drive root (e.g. "I:\") — it exists and Windows throws EPERM.
  if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
  for (const f of buildStripKit(req)) {
    // .ps1 gets a BOM (PS 5.1 reads em-dashes correctly); .bat stays ASCII.
    const content = f.bom ? `﻿${f.content}` : f.content;
    writeFileSync(join(folder, f.name), content, f.name.endsWith(".bat") ? "ascii" : "utf8");
  }
  // Stage wallpaper / lock-screen images into wallpapers/ next to bootible.ps1.
  // The script copies them to the user's Pictures and sets them at runtime.
  const images: [string | undefined, string][] = [
    [req.wallpaperPath, "background"],
    [req.lockscreenPath, "lockscreen"],
  ];
  const staged = images.filter(([src]) => src);
  if (staged.length > 0) {
    const wpDir = join(folder, "wallpapers");
    mkdirSync(wpDir, { recursive: true });
    for (const [src, name] of staged) {
      if (!src) continue;
      copyFileSync(src, join(wpDir, `${name}${extname(src) || ".jpg"}`));
    }
  }
}

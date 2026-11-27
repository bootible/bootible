import type { BuildManifest } from "./build-manifest";
import { generateDeckVerify } from "./deck-verify";
import { generateWindowsVerify, WINDOWS_VERIFY_PATH, windowsVerifyArgs } from "./windows-verify";

/** How to run a device's verify script over SSH. On a Deck the script is fed to
 *  `bash -s` on stdin. On Windows it is first copied to `upload` (scp) and then
 *  run as a file — see WINDOWS_VERIFY_PATH for why not stdin. */
export interface VerifyPlan {
  script: string;
  /** Remote command for the device's login shell. */
  remote: string;
  /** scp destination for the script, when it must go over as a file. */
  upload?: string;
}

export function verifyPlan(m: BuildManifest): VerifyPlan {
  if (m.os === "linux") return { script: generateDeckVerify(m.deck), remote: "bash -s" };
  return {
    script: generateWindowsVerify(m),
    remote: `powershell ${windowsVerifyArgs(WINDOWS_VERIFY_PATH).join(" ")}`,
    upload: WINDOWS_VERIFY_PATH.replace(/\\/g, "/"),
  };
}

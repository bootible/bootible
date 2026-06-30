// The cloud-account auth flow, split by step: welcome / sign-in (welcome.ts), the
// sync-key passphrase setup/unlock/recovery (synckey.ts), and two-factor enroll/
// challenge/disable (twofa.ts), over shared primitives (shared.ts). Importing this
// barrel registers every step's DOM handlers and re-exports the three entry points
// main needs: the cloud handle, the account-chip refresh, and the post-sign-in router.
export { cloud } from "./shared";
export { afterSignIn } from "./synckey";
export { refreshAccount } from "./welcome";

import "./twofa";

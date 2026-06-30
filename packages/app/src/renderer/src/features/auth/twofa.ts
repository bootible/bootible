import QRCode from "qrcode";
import { cloud as cloudHandle, withBusy } from "./shared";
import { afterSignIn, copyToClipboard } from "./synckey";
import { refreshAccount } from "./welcome";

// Re-bind to a module const so `if (!cloud) return` narrows into the nested
// withBusy(...) callbacks (an imported binding doesn't narrow across closures).
const cloud = cloudHandle;

// ── Two-factor (TOTP) ─────────────────────────────────────────────────────────
function twofaErr(id: string, msg: string | null): void {
  const errEl = document.querySelector<HTMLElement>(id);
  if (errEl) errEl.textContent = msg ?? "";
}

// Sign-in challenge: verify the code, then continue the normal post-sign-in flow.
document.querySelector<HTMLButtonElement>("#twofa-verify")?.addEventListener("click", () => {
  void (async () => {
    if (!cloud) return;
    const code = document.querySelector<HTMLInputElement>("#twofa-code")?.value.trim() ?? "";
    twofaErr("#twofa-error", null);
    if (!code) return twofaErr("#twofa-error", "Enter the 6-digit code.");
    const r = await withBusy(document.querySelector<HTMLButtonElement>("#twofa-verify"), () =>
      cloud.verifyTotp(code),
    );
    if (r.ok) await afterSignIn();
    else twofaErr("#twofa-error", r.error ?? "That code didn't match.");
  })();
});

// Open the setup/disable screen from the account chip, in the right mode.
function openTwofaSetup(enabled: boolean): void {
  document.querySelector<HTMLElement>("#twofa-step-pass")?.toggleAttribute("hidden", enabled);
  document.querySelector<HTMLElement>("#twofa-step-verify")?.setAttribute("hidden", "");
  document.querySelector<HTMLElement>("#twofa-step-disable")?.toggleAttribute("hidden", !enabled);
  const title = document.querySelector<HTMLElement>("#twofasetup-title");
  if (title) title.textContent = enabled ? "Two-factor is on" : "Set up two-factor";
  for (const id of ["#twofa-pass", "#twofa-confirm-code", "#twofa-disable-pass"]) {
    const el = document.querySelector<HTMLInputElement>(id);
    if (el) el.value = "";
  }
  for (const id of ["#twofasetup-error", "#twofasetup-error2", "#twofasetup-error3"])
    twofaErr(id, null);
  location.hash = "twofasetup";
}

document.querySelector<HTMLButtonElement>("#account-2fa")?.addEventListener("click", () => {
  void (async () => {
    if (!cloud) return;
    openTwofaSetup(!!(await cloud.status()).twoFactorEnabled);
  })();
});

// Enroll step 1: password → enable → render QR + backup codes.
document.querySelector<HTMLButtonElement>("#twofa-enable")?.addEventListener("click", () => {
  void (async () => {
    if (!cloud) return;
    const password = document.querySelector<HTMLInputElement>("#twofa-pass")?.value ?? "";
    twofaErr("#twofasetup-error", null);
    if (!password) return twofaErr("#twofasetup-error", "Enter your account password.");
    const r = await withBusy(document.querySelector<HTMLButtonElement>("#twofa-enable"), () =>
      cloud.enable2FA(password),
    );
    if (!r.ok) return twofaErr("#twofasetup-error", r.error ?? "Couldn't start setup.");
    const img = document.querySelector<HTMLImageElement>("#twofa-qr");
    if (img && r.totpURI) img.src = await QRCode.toDataURL(r.totpURI, { margin: 1, width: 200 });
    const bk = document.querySelector<HTMLElement>("#twofa-backup");
    if (bk) bk.textContent = (r.backupCodes ?? []).join("  ");
    document.querySelector<HTMLElement>("#twofa-step-pass")?.setAttribute("hidden", "");
    document.querySelector<HTMLElement>("#twofa-step-verify")?.removeAttribute("hidden");
  })();
});

// Enroll step 2: confirm a code → 2FA on.
document.querySelector<HTMLButtonElement>("#twofa-confirm")?.addEventListener("click", () => {
  void (async () => {
    if (!cloud) return;
    const code =
      document.querySelector<HTMLInputElement>("#twofa-confirm-code")?.value.trim() ?? "";
    twofaErr("#twofasetup-error2", null);
    if (!code) return twofaErr("#twofasetup-error2", "Enter a code from your app.");
    const r = await withBusy(document.querySelector<HTMLButtonElement>("#twofa-confirm"), () =>
      cloud.verify2FASetup(code),
    );
    if (!r.ok) return twofaErr("#twofasetup-error2", r.error ?? "That code didn't match.");
    await refreshAccount();
    location.hash = "platform";
  })();
});

document.querySelector<HTMLButtonElement>("#twofa-backup-copy")?.addEventListener("click", (e) => {
  const codes = document.querySelector<HTMLElement>("#twofa-backup")?.textContent ?? "";
  void copyToClipboard(codes, e.currentTarget as HTMLButtonElement);
});

// Disable.
document.querySelector<HTMLButtonElement>("#twofa-disable")?.addEventListener("click", () => {
  void (async () => {
    if (!cloud) return;
    const password = document.querySelector<HTMLInputElement>("#twofa-disable-pass")?.value ?? "";
    twofaErr("#twofasetup-error3", null);
    if (!password) return twofaErr("#twofasetup-error3", "Enter your account password.");
    const r = await withBusy(document.querySelector<HTMLButtonElement>("#twofa-disable"), () =>
      cloud.disable2FA(password),
    );
    if (!r.ok) return twofaErr("#twofasetup-error3", r.error ?? "Couldn't disable 2FA.");
    await refreshAccount();
    location.hash = "platform";
  })();
});

// RECORDED REASON for >400 lines (coding-standard §4): the auth flow (welcome /
// sign-in, sync-key passphrase, 2FA) carved out of main.ts as one unit. Next
// decomposition target — split into auth/{welcome,synckey,twofa}.ts — but getting
// it out of the god-file is the win first. See docs/v2/standards/remediation-plan.md P3.
import QRCode from "qrcode";
import { el } from "../lib/dom";
import { logoMap } from "../lib/logos";
import wordlistRaw from "../wordlist.txt?raw";

// EFF diceware wordlist (7776 words) for generating real word-passphrases.
const WORDLIST = wordlistRaw
  .split("\n")
  .map((w) => w.trim())
  .filter(Boolean);

// Sign-in provider brand icons (full colour, on dark circular buttons).
const AUTH_LOGOS = logoMap(
  import.meta.glob("../assets/logos/auth/*.svg", { eager: true, query: "?url", import: "default" }),
);

// ── Welcome / sign-in ───────────────────────────────────────────────────────
export const cloud = window.bootible?.cloud;

/** Reflect the signed-in account (email + Sign out) in the top bar. */
export async function refreshAccount(): Promise<void> {
  const acct = document.querySelector<HTMLElement>("#account");
  const emailEl = document.querySelector<HTMLElement>("#account-email");
  const twofaBtn = document.querySelector<HTMLButtonElement>("#account-2fa");
  if (!acct || !cloud) return;
  const s = await cloud.status();
  if (s.signedIn) {
    if (emailEl) emailEl.textContent = s.email ?? "Signed in";
    if (twofaBtn) {
      twofaBtn.textContent = s.twoFactorEnabled ? "2FA on" : "Set up 2FA";
      twofaBtn.hidden = false;
    }
    acct.hidden = false;
  } else {
    acct.hidden = true;
    if (twofaBtn) twofaBtn.hidden = true;
  }
}

document.querySelector<HTMLButtonElement>("#account-signout")?.addEventListener("click", () => {
  void (async () => {
    if (!cloud) return;
    await cloud.signOut();
    const emailEl = document.querySelector<HTMLElement>("#account-email");
    if (emailEl) emailEl.textContent = "";
    document.querySelector<HTMLElement>("#account")?.setAttribute("hidden", "");
    location.hash = "welcome";
  })();
});

function welcomeError(msg: string | null): void {
  const el = document.querySelector<HTMLElement>("#welcome-error");
  if (el) el.textContent = msg ?? ""; // space is reserved in CSS — no reflow
}

/** Disable a button + show a spinner while an async action runs, then restore. */
async function withBusy<T>(
  btn: HTMLButtonElement | null | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (btn) {
    btn.disabled = true;
    btn.classList.add("busy");
  }
  try {
    return await fn();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("busy");
    }
  }
}

async function doEmailAuth(mode: "signin" | "signup"): Promise<void> {
  if (!cloud) return;
  const email = document.querySelector<HTMLInputElement>("#welcome-email")?.value.trim() ?? "";
  const password = document.querySelector<HTMLInputElement>("#welcome-pass")?.value ?? "";
  if (!email || password.length < 8) {
    welcomeError("Enter your email and an 8+ character password.");
    return;
  }
  welcomeError(null);
  const btn = document.querySelector<HTMLButtonElement>(`[data-auth='${mode}']`);
  const r = await withBusy(btn, () =>
    mode === "signup"
      ? cloud.signUpEmail({ email, password })
      : cloud.signInEmail({ email, password }),
  );
  if (r.needsVerification) return showVerifyMail(email); // sign-in blocked until verified
  if (!r.ok) {
    welcomeError(r.error ?? "Sign-in failed.");
    return;
  }
  if (mode === "signup") return showVerifyMail(email); // new account must verify first
  if ((r as { twoFactor?: boolean }).twoFactor)
    location.hash = "twofa"; // second factor required
  else void afterSignIn();
}

let pendingVerifyEmail = "";
function showVerifyMail(email: string): void {
  pendingVerifyEmail = email;
  const addr = document.querySelector<HTMLElement>("#verify-email-addr");
  if (addr) addr.textContent = email;
  const msg = document.querySelector<HTMLElement>("#verify-msg");
  if (msg) msg.textContent = "";
  location.hash = "verifymail";
}

// ── Sync-key step (passphrase setup / unlock / recovery) ─────────────────────
type SyncMode = "setup" | "unlock" | "recovery" | "reset";
let syncMode: SyncMode = "setup";
let setupOwn = false; // setup sub-mode: false = generated, true = the user's own
let generatedPass = "";

function syncEl<T extends HTMLElement>(id: string): T | null {
  return document.querySelector<T>(id);
}
function syncError(msg: string | null): void {
  const el = syncEl<HTMLElement>("#synckey-error");
  if (el) el.textContent = msg ?? "";
}

/** A diceware passphrase: 6 random words from the EFF list (~77 bits). */
function genPassphrase(): string {
  const rand = crypto.getRandomValues(new Uint32Array(6));
  return Array.from(rand, (r) => WORDLIST[r % WORDLIST.length] ?? "").join(" ");
}

async function copyToClipboard(text: string, btn: HTMLButtonElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent ?? "";
    btn.textContent = "Copied!";
    setTimeout(() => {
      btn.textContent = original;
    }, 1500);
  } catch {
    syncError("Couldn't copy — select the text and copy manually.");
  }
}

/** Within setup, switch between a generated passphrase and the user's own. */
function applySetupSubmode(): void {
  const pass = syncEl<HTMLInputElement>("#synckey-pass");
  const confirm = syncEl<HTMLInputElement>("#synckey-confirm");
  const genActions = syncEl<HTMLElement>("#synckey-gen-actions");
  const ownToggle = syncEl<HTMLButtonElement>("#synckey-own-toggle");
  if (!setupOwn) {
    if (!generatedPass) generatedPass = genPassphrase();
    if (pass) {
      pass.readOnly = true;
      pass.type = "text";
      pass.value = generatedPass;
    }
    confirm?.setAttribute("hidden", "");
    genActions?.removeAttribute("hidden");
    if (ownToggle) ownToggle.textContent = "Set my own passphrase instead";
  } else {
    if (pass) {
      pass.readOnly = false;
      pass.type = "password";
      pass.value = "";
      pass.placeholder = "Sync passphrase (8+ characters)";
    }
    if (confirm) confirm.value = "";
    confirm?.removeAttribute("hidden");
    genActions?.setAttribute("hidden", "");
    if (ownToggle) ownToggle.textContent = "Use a generated passphrase instead";
  }
}

/** After sign-in, route to set/unlock the sync key, or straight in if ready. */
export async function afterSignIn(): Promise<void> {
  if (!cloud) {
    location.hash = "platform";
    return;
  }
  void refreshAccount();
  const ks = await cloud.keyStatus();
  if (!ks.signedIn || ks.unlocked) {
    if (ks.unlocked) void cloud.syncNow(); // sync on entry when already unlocked
    location.hash = "platform";
    return;
  }
  configureSyncKey(ks.hasServerKey ? "unlock" : "setup");
  location.hash = "synckey";
}

function configureSyncKey(mode: SyncMode): void {
  syncMode = mode;
  const title = syncEl<HTMLElement>("#synckey-title");
  const sub = syncEl<HTMLElement>("#synckey-sub");
  const pass = syncEl<HTMLInputElement>("#synckey-pass");
  const confirm = syncEl<HTMLInputElement>("#synckey-confirm");
  const submit = syncEl<HTMLButtonElement>("#synckey-submit");
  const ownToggle = syncEl<HTMLButtonElement>("#synckey-own-toggle");
  const recToggle = syncEl<HTMLButtonElement>("#synckey-recovery-toggle");
  const genActions = syncEl<HTMLElement>("#synckey-gen-actions");
  syncEl<HTMLElement>("#synckey-form")?.removeAttribute("hidden");
  syncEl<HTMLElement>("#synckey-recovery")?.setAttribute("hidden", "");
  syncError(null);

  if (mode === "setup" || mode === "reset") {
    if (title)
      title.textContent = mode === "reset" ? "Set a new passphrase" : "Set a sync passphrase";
    if (sub)
      sub.textContent =
        mode === "reset"
          ? "Recovered. Choose a new passphrase to lock your synced secrets — your recovery code stays the same."
          : "This encrypts your saved secrets before they ever leave this device — we can't see it or reset it. Save it in your password manager; you'll also get a one-time recovery code.";
    if (submit) submit.textContent = mode === "reset" ? "Set new passphrase" : "Set passphrase";
    ownToggle?.removeAttribute("hidden");
    recToggle?.setAttribute("hidden", "");
    setupOwn = false;
    generatedPass = genPassphrase();
    applySetupSubmode();
    return;
  }

  // unlock / recovery — a single editable field, no generated controls.
  genActions?.setAttribute("hidden", "");
  ownToggle?.setAttribute("hidden", "");
  confirm?.setAttribute("hidden", "");
  if (pass) {
    pass.readOnly = false;
    pass.type = "password";
    pass.value = "";
  }
  recToggle?.removeAttribute("hidden");
  if (mode === "unlock") {
    if (title) title.textContent = "Unlock your synced secrets";
    if (sub) sub.textContent = "Enter your sync passphrase to decrypt your secrets on this device.";
    if (pass) pass.placeholder = "Sync passphrase";
    if (submit) submit.textContent = "Unlock";
    if (recToggle) recToggle.textContent = "Use a recovery code instead";
  } else {
    if (title) title.textContent = "Enter your recovery code";
    if (sub) sub.textContent = "Use the one-time recovery code you saved when you set up sync.";
    if (pass) pass.placeholder = "xxxx-xxxx-xxxx-xxxx";
    if (submit) submit.textContent = "Unlock with code";
    if (recToggle) recToggle.textContent = "Use my passphrase instead";
  }
}

async function submitSyncKey(): Promise<void> {
  if (!cloud) return;
  const pass = syncEl<HTMLInputElement>("#synckey-pass")?.value.trim() ?? "";
  syncError(null);
  if (syncMode === "setup" || syncMode === "reset") {
    if (setupOwn) {
      const confirm = syncEl<HTMLInputElement>("#synckey-confirm")?.value.trim() ?? "";
      if (pass.length < 8) return syncError("Use a passphrase of at least 8 characters.");
      if (pass !== confirm) return syncError("The passphrases don't match.");
    }
    const r = syncMode === "reset" ? await cloud.resetPassphrase(pass) : await cloud.setupKey(pass);
    if (!r.ok) return syncError(r.error ?? "Couldn't set the passphrase.");
    if (syncMode === "reset") {
      location.hash = "platform"; // recovery code unchanged — straight in
      return;
    }
    // Setup: reveal the recovery code; the user continues from there.
    const code = syncEl<HTMLElement>("#recovery-code");
    if (code) code.textContent = (r as { recoveryCode?: string }).recoveryCode ?? "";
    syncEl<HTMLElement>("#synckey-form")?.setAttribute("hidden", "");
    syncEl<HTMLElement>("#synckey-recovery")?.removeAttribute("hidden");
    return;
  }
  if (!pass) return syncError("Enter your passphrase.");
  const r = syncMode === "recovery" ? await cloud.unlockRecovery(pass) : await cloud.unlock(pass);
  if (!r.ok) return syncError(r.error ?? "That didn't work.");
  // Recovered → make them set a fresh passphrase; a plain unlock goes straight in.
  if (syncMode === "recovery") configureSyncKey("reset");
  else location.hash = "platform";
}

syncEl<HTMLButtonElement>("#synckey-submit")?.addEventListener("click", () =>
  withBusy(syncEl<HTMLButtonElement>("#synckey-submit"), submitSyncKey),
);
syncEl<HTMLButtonElement>("#synckey-done")?.addEventListener("click", () => {
  location.hash = "platform";
});
syncEl<HTMLButtonElement>("#synckey-recovery-toggle")?.addEventListener("click", () =>
  configureSyncKey(syncMode === "recovery" ? "unlock" : "recovery"),
);
syncEl<HTMLButtonElement>("#synckey-own-toggle")?.addEventListener("click", () => {
  setupOwn = !setupOwn;
  applySetupSubmode();
});
syncEl<HTMLButtonElement>("#synckey-regen")?.addEventListener("click", () => {
  generatedPass = genPassphrase();
  const pass = syncEl<HTMLInputElement>("#synckey-pass");
  if (pass) pass.value = generatedPass;
});
syncEl<HTMLButtonElement>("#synckey-copy")?.addEventListener("click", (e) => {
  void copyToClipboard(generatedPass, e.currentTarget as HTMLButtonElement);
});
syncEl<HTMLButtonElement>("#recovery-copy")?.addEventListener("click", (e) => {
  const code = syncEl<HTMLElement>("#recovery-code")?.textContent ?? "";
  void copyToClipboard(code, e.currentTarget as HTMLButtonElement);
});

// ── Two-factor (TOTP) ─────────────────────────────────────────────────────────
function twofaErr(id: string, msg: string | null): void {
  const el = document.querySelector<HTMLElement>(id);
  if (el) el.textContent = msg ?? "";
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

// Enter in any field on the sync-key / 2FA cards triggers the visible primary button.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const t = e.target;
  if (!(t instanceof HTMLInputElement)) return;
  const card = t.closest(".synckey-card");
  if (!card) return;
  const btn = Array.from(card.querySelectorAll<HTMLButtonElement>(".btn-primary")).find(
    (b) => b.offsetParent !== null,
  );
  if (btn) {
    e.preventDefault();
    btn.click();
  }
});

document.querySelector<HTMLFormElement>("#welcome-email-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  void doEmailAuth("signin");
});
document
  .querySelector<HTMLButtonElement>("[data-auth='signup']")
  ?.addEventListener("click", () => void doEmailAuth("signup"));

// Check-your-email view: resend the verification link / go back to sign in.
document.querySelector<HTMLButtonElement>("#verify-resend")?.addEventListener("click", (e) => {
  void (async () => {
    if (!cloud || !pendingVerifyEmail) return;
    const msg = document.querySelector<HTMLElement>("#verify-msg");
    const r = await withBusy(e.currentTarget as HTMLButtonElement, () =>
      cloud.resendVerification(pendingVerifyEmail),
    );
    if (msg) msg.textContent = r.ok ? "Sent — check your inbox." : (r.error ?? "Couldn't resend.");
  })();
});
document.querySelector<HTMLButtonElement>("#verify-back")?.addEventListener("click", () => {
  location.hash = "welcome";
});

// Forgot password: email a reset link (completed on the Worker /reset-password page).
document.querySelector<HTMLButtonElement>("#forgot-pw")?.addEventListener("click", (e) => {
  void (async () => {
    if (!cloud) return;
    const email = document.querySelector<HTMLInputElement>("#welcome-email")?.value.trim() ?? "";
    if (!email) {
      welcomeError("Enter your email above, then tap Forgot password.");
      return;
    }
    const r = await withBusy(e.currentTarget as HTMLButtonElement, () =>
      cloud.requestPasswordReset(email),
    );
    welcomeError(
      r.ok
        ? `Reset link sent to ${email} — check your inbox.`
        : (r.error ?? "Couldn't send the reset email."),
    );
  })();
});

// Social provider icons + interim handler. Real brand SVGs live in assets/logos/auth/
// (discord present; google/github/twitch fall back to a monogram until dropped in).
// Browser token capture is the next step.
for (const btn of document.querySelectorAll<HTMLButtonElement>(".provider-ico")) {
  const provider = btn.dataset.provider ?? "";
  const url = AUTH_LOGOS[provider];
  if (url) {
    const img = el("img", "provider-ico-img") as HTMLImageElement;
    img.src = url;
    img.alt = "";
    btn.appendChild(img);
  } else {
    btn.textContent = btn.dataset.mono ?? provider.charAt(0).toUpperCase();
  }
  btn.addEventListener("click", () => {
    void (async () => {
      if (!cloud) return;
      welcomeError(null);
      const r = await withBusy(btn, () => cloud.signInSocial(provider));
      if (r.ok) await afterSignIn();
      else if (r.error !== "Sign-in was cancelled.") welcomeError(r.error ?? "Sign-in failed.");
    })();
  });
}

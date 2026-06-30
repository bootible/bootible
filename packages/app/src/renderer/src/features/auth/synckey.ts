import wordlistRaw from "../../wordlist.txt?raw";
import { cloud, withBusy } from "./shared";
import { refreshAccount } from "./welcome";

// EFF diceware wordlist (7776 words) for generating real word-passphrases.
const WORDLIST = wordlistRaw
  .split("\n")
  .map((w) => w.trim())
  .filter(Boolean);

// ── Sync-key step (passphrase setup / unlock / recovery) ─────────────────────
type SyncMode = "setup" | "unlock" | "recovery" | "reset";
let syncMode: SyncMode = "setup";
let setupOwn = false; // setup sub-mode: false = generated, true = the user's own
let generatedPass = "";

function syncEl<T extends HTMLElement>(id: string): T | null {
  return document.querySelector<T>(id);
}
function syncError(msg: string | null): void {
  const errEl = syncEl<HTMLElement>("#synckey-error");
  if (errEl) errEl.textContent = msg ?? "";
}

/** A diceware passphrase: 6 random words from the EFF list (~77 bits). */
function genPassphrase(): string {
  const rand = crypto.getRandomValues(new Uint32Array(6));
  return Array.from(rand, (r) => WORDLIST[r % WORDLIST.length] ?? "").join(" ");
}

/** Copy text to the clipboard with transient "Copied!" feedback on the button. */
export async function copyToClipboard(text: string, btn: HTMLButtonElement): Promise<void> {
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

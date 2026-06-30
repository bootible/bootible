import { el } from "../../lib/dom";
import { logoMap } from "../../lib/logos";
import { cloud as cloudHandle, withBusy } from "./shared";
import { afterSignIn } from "./synckey";

// Re-bind to a module const so `if (!cloud) return` narrows into the nested
// withBusy(...) callbacks — an imported binding is treated as live and doesn't
// narrow across closures the way the original module-local const did.
const cloud = cloudHandle;

// Sign-in provider brand icons (full colour, on dark circular buttons).
const AUTH_LOGOS = logoMap(
  import.meta.glob("../../assets/logos/auth/*.svg", {
    eager: true,
    query: "?url",
    import: "default",
  }),
);

// ── Welcome / sign-in ───────────────────────────────────────────────────────

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
  const errEl = document.querySelector<HTMLElement>("#welcome-error");
  if (errEl) errEl.textContent = msg ?? ""; // space is reserved in CSS — no reflow
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

import type { Bindings } from "./env";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Send a transactional email via Resend's HTTP API (no SDK needed in a Worker).
 * No-ops with a warning when RESEND_API_KEY isn't set, so the Worker still runs
 * with email disabled.
 */
export async function sendEmail(
  env: Bindings,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY unset — skipped "${subject}" to ${to}`);
    return;
  }
  const from = env.EMAIL_FROM ?? "bootible <noreply@bootible.dev>";
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text().catch(() => "")}`);
  }
}

/** Minimal branded wrapper for transactional emails. */
function layout(heading: string, body: string, url: string, label: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0e0f12;color:#eceae3;font-family:system-ui,'Segoe UI',sans-serif;padding:32px">
  <div style="max-width:480px;margin:0 auto">
    <h1 style="font-size:20px;margin:0 0 16px">${heading}</h1>
    <p style="color:#b7bcc6;line-height:1.5;margin:0 0 24px">${body}</p>
    <a href="${url}" style="display:inline-block;background:#f0a000;color:#0e0f12;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:8px">${label}</a>
    <p style="color:#6b7280;font-size:12px;margin:24px 0 0">If the button doesn't work, copy this link:<br><span style="color:#8b919c;word-break:break-all">${url}</span></p>
  </div></body></html>`;
}

export function verificationEmail(url: string): { subject: string; html: string } {
  return {
    subject: "Verify your bootible email",
    html: layout(
      "Verify your email",
      "Confirm this address to finish setting up your bootible account and to sign in with Google, GitHub, Discord or Twitch.",
      url,
      "Verify email",
    ),
  };
}

export function resetPasswordEmail(url: string): { subject: string; html: string } {
  return {
    subject: "Reset your bootible password",
    html: layout(
      "Reset your password",
      "Click below to choose a new password. If you didn't request this, you can safely ignore this email.",
      url,
      "Reset password",
    ),
  };
}

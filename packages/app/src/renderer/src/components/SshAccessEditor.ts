import { el } from "../lib/dom";

export interface HostKey {
  id: string;
  label: string;
  type: string;
  publicKey: string;
}

export interface SshAccessValue {
  /** Selected host-key ids (keys discovered on THIS PC). */
  hostKeyIds: string[];
  /** GitHub username — keys fetched at build (ROG) or on-device (Deck). */
  githubUser?: string;
  /** Pasted public keys (one per line). */
  pastedKeys: string[];
  /** Optional SSH port (devices that expose it). */
  port?: number;
}

export interface SshAccessOptions {
  /** Keys discovered on this PC; empty hides the "From this PC" section (e.g. Deck). */
  hostKeys: readonly HostKey[];
  value: SshAccessValue;
  /** Show the port field (e.g. the Deck). */
  showPort?: boolean;
  /** Live GitHub key count for the current username (null/undefined = not checked). */
  githubKeyCount?: number | null;
  onChange(next: SshAccessValue): void;
  /** Fired when the GitHub username changes, so the host can fetch a live count. */
  onGithubUser?(user: string): void;
}

/**
 * One SSH-access editor for every device (cohesion U3). Model: "keys enable SSH" —
 * SSH is on when any key is supplied. Sources: From this PC (host-key discovery,
 * shown only where keys exist), a GitHub username, and pasted keys. The host wires
 * how each source resolves (ROG bakes GitHub keys at build; the Deck fetches them
 * on-device). Presentational + emits the full value on every change.
 */
export function SshAccessEditor(o: SshAccessOptions): HTMLElement {
  const v = o.value;
  const emit = (patch: Partial<SshAccessValue>): void => o.onChange({ ...v, ...patch });
  const root = el("div", "ssh-access");

  const keyCount =
    v.hostKeyIds.length +
    v.pastedKeys.length +
    (o.githubKeyCount && v.githubUser ? o.githubKeyCount : v.githubUser ? 1 : 0);
  const summary = el(
    "p",
    "ssh-summary",
    keyCount > 0 ? `SSH on — ${keyCount} key source(s)` : "SSH off — add a key to enable it",
  );
  summary.dataset.field = "summary";
  root.append(summary);

  // From this PC — host-key discovery (only where keys exist).
  if (o.hostKeys.length > 0) {
    const sec = el("div", "ssh-sec cz-span");
    sec.dataset.field = "hostkeys";
    sec.append(el("div", "cz-name", "From this PC"));
    for (const k of o.hostKeys) {
      const row = el("label", "app-row");
      const cb = el("input", "app-check") as HTMLInputElement;
      cb.type = "checkbox";
      cb.dataset.hostkey = k.id;
      cb.checked = v.hostKeyIds.includes(k.id);
      cb.addEventListener("change", () => {
        const set = new Set(v.hostKeyIds);
        if (cb.checked) set.add(k.id);
        else set.delete(k.id);
        emit({ hostKeyIds: [...set] });
      });
      const meta = el("span", "app-meta");
      meta.append(el("span", "app-name", k.label), el("span", "app-id", k.type));
      row.append(cb, meta);
      sec.append(row);
    }
    root.append(sec);
  }

  // GitHub username.
  const gh = el("div", "ssh-sec cz-span");
  gh.append(el("div", "cz-name", "From GitHub"));
  const ghInput = el("input", "uw-select") as HTMLInputElement;
  ghInput.type = "text";
  ghInput.dataset.field = "github";
  ghInput.placeholder = "GitHub username — adds github.com/<user>.keys";
  ghInput.value = v.githubUser ?? "";
  ghInput.addEventListener("input", () => {
    const user = ghInput.value.trim().replace(/[^A-Za-z0-9-]/g, "") || undefined;
    emit({ githubUser: user });
    o.onGithubUser?.(user ?? "");
  });
  gh.append(ghInput);
  if (o.githubKeyCount != null && v.githubUser) {
    gh.append(
      el("p", "ssh-ghcount", `✓ ${o.githubKeyCount} key(s) from github.com/${v.githubUser}.keys`),
    );
  }
  root.append(gh);

  // Paste.
  const paste = el("div", "ssh-sec cz-span");
  paste.append(el("div", "cz-name", "Paste a key"));
  const ta = el("textarea", "uw-select") as HTMLTextAreaElement;
  ta.dataset.field = "paste";
  ta.rows = 2;
  ta.placeholder = "…or paste public keys, one per line";
  ta.value = v.pastedKeys.join("\n");
  ta.addEventListener("input", () => {
    emit({
      pastedKeys: ta.value
        .split("\n")
        .map((k) => k.trim())
        .filter(Boolean),
    });
  });
  paste.append(ta);
  root.append(paste);

  // Optional port.
  if (o.showPort) {
    const portWrap = el("div", "ssh-sec cz-span");
    portWrap.append(el("div", "cz-name", "SSH port"));
    const port = el("input", "uw-select") as HTMLInputElement;
    port.type = "number";
    port.dataset.field = "port";
    port.placeholder = "22";
    port.value = v.port ? String(v.port) : "";
    port.addEventListener("input", () => {
      emit({ port: Number(port.value) || undefined });
    });
    portWrap.append(port);
    root.append(portWrap);
  }

  return root;
}

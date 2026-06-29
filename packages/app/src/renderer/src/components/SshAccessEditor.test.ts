// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { SshAccessEditor } from "./SshAccessEditor";

const get = <T extends Element>(r: Element, s: string): T => {
  const el = r.querySelector<T>(s);
  if (!el) throw new Error(`element not found: ${s}`);
  return el;
};
const fire = (el: Element, t: string) => el.dispatchEvent(new Event(t, { bubbles: true }));
const hostKeys = [
  { id: "id_ed25519.pub", label: "gavin@desk", type: "ssh-ed25519", publicKey: "ssh-ed25519 AAA gavin@desk" },
];
const empty = { hostKeyIds: [], pastedKeys: [] };

describe("SshAccessEditor", () => {
  it("shows host-key discovery only when host keys are available", () => {
    expect(
      SshAccessEditor({ hostKeys: [], value: empty, onChange: vi.fn() }).querySelector(
        "[data-field=hostkeys]",
      ),
    ).toBeNull();
    const withHost = SshAccessEditor({ hostKeys, value: empty, onChange: vi.fn() });
    expect(withHost.querySelector("[data-field=hostkeys]")).not.toBeNull();
  });

  it("toggling a host key emits its id", () => {
    const onChange = vi.fn();
    const root = SshAccessEditor({ hostKeys, value: empty, onChange });
    const cb = get<HTMLInputElement>(root, "[data-hostkey='id_ed25519.pub']");
    cb.checked = true;
    fire(cb, "change");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ hostKeyIds: ["id_ed25519.pub"] }),
    );
  });

  it("typing a GitHub username emits it and requests a key-count fetch", () => {
    const onChange = vi.fn();
    const onGithubUser = vi.fn();
    const root = SshAccessEditor({ hostKeys: [], value: empty, onChange, onGithubUser });
    const input = get<HTMLInputElement>(root, "[data-field=github]");
    input.value = "octocat";
    fire(input, "input");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ githubUser: "octocat" }));
    expect(onGithubUser).toHaveBeenCalledWith("octocat");
  });

  it("splits pasted keys into lines", () => {
    const onChange = vi.fn();
    const root = SshAccessEditor({ hostKeys: [], value: empty, onChange });
    const ta = get<HTMLTextAreaElement>(root, "[data-field=paste]");
    ta.value = "ssh-ed25519 AAA a\n\nssh-rsa BBB b\n";
    fire(ta, "input");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ pastedKeys: ["ssh-ed25519 AAA a", "ssh-rsa BBB b"] }),
    );
  });

  it("shows a port field only when showPort is set", () => {
    expect(
      SshAccessEditor({ hostKeys: [], value: empty, onChange: vi.fn() }).querySelector(
        "[data-field=port]",
      ),
    ).toBeNull();
    expect(
      SshAccessEditor({ hostKeys: [], value: { ...empty, port: 22 }, showPort: true, onChange: vi.fn() }).querySelector(
        "[data-field=port]",
      ),
    ).not.toBeNull();
  });
});

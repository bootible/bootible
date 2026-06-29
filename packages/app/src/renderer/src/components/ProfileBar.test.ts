// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { ProfileBar } from "./ProfileBar";

const profiles = [{ name: "Alpha" }, { name: "Beta" }];
/** Query that asserts presence (non-null without a `!` assertion). */
const get = <T extends Element>(r: Element, s: string): T => {
  const el = r.querySelector<T>(s);
  if (!el) throw new Error(`element not found: ${s}`);
  return el;
};
const fire = (el: Element, t: string) => el.dispatchEvent(new Event(t, { bubbles: true }));
const handlers = () => ({
  onLoad: vi.fn(),
  onSaveNew: vi.fn(),
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
});

describe("ProfileBar", () => {
  it("lists saved profiles and loads the selected one", () => {
    const h = handlers();
    const bar = ProfileBar({ profiles, ...h });
    const sel = get<HTMLSelectElement>(bar, "[data-field=select]");
    expect([...sel.querySelectorAll("option")].map((o) => o.value).filter(Boolean)).toEqual([
      "Alpha",
      "Beta",
    ]);
    sel.value = "Beta";
    fire(sel, "change");
    get<HTMLButtonElement>(bar, "[data-action=load]").click();
    expect(h.onLoad).toHaveBeenCalledWith("Beta");
  });

  it("saves a new profile from the name field", () => {
    const h = handlers();
    const bar = ProfileBar({ profiles, ...h });
    const name = get<HTMLInputElement>(bar, "[data-field=name]");
    name.value = "Gamma";
    fire(name, "input");
    get<HTMLButtonElement>(bar, "[data-action=save-new]").click();
    expect(h.onSaveNew).toHaveBeenCalledWith("Gamma");
  });

  it("shows Update only when a profile is loaded, and updates that one", () => {
    const h = handlers();
    expect(ProfileBar({ profiles, ...h }).querySelector("[data-action=update]")).toBeNull();
    const loaded = ProfileBar({ profiles, loadedName: "Alpha", ...h });
    get<HTMLButtonElement>(loaded, "[data-action=update]").click();
    expect(h.onUpdate).toHaveBeenCalledWith("Alpha");
  });

  it("deletes the selected/loaded profile", () => {
    const h = handlers();
    const bar = ProfileBar({ profiles, loadedName: "Alpha", ...h });
    get<HTMLButtonElement>(bar, "[data-action=delete]").click();
    expect(h.onDelete).toHaveBeenCalledWith("Alpha");
  });

  it("shows a status message and an empty-state when there are no profiles", () => {
    const h = handlers();
    const bar = ProfileBar({ profiles: [], status: "Saved ✓", ...h });
    expect(get(bar, "[data-field=status]").textContent).toContain("Saved");
    const sel = get<HTMLSelectElement>(bar, "[data-field=select]");
    expect(sel.querySelector("option")?.textContent?.toLowerCase()).toContain("no saved");
  });
});

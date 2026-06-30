// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { ProfileBar } from "./ProfileBar";

const profiles = { model: [{ name: "Alpha" }, { name: "Beta" }], family: [] };
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

  it("Update overwrites the loaded profile when nothing else is picked", () => {
    const h = handlers();
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
    const bar = ProfileBar({ profiles: { model: [], family: [] }, status: "Saved ✓", ...h });
    expect(get(bar, "[data-field=status]").textContent).toContain("Saved");
    const sel = get<HTMLSelectElement>(bar, "[data-field=select]");
    expect(sel.querySelector("option")?.textContent?.toLowerCase()).toContain("no saved");
  });

  it("load mode shows the picker but no save controls", () => {
    const h = handlers();
    const bar = ProfileBar({ profiles, mode: "load", loadedName: "Alpha", ...h });
    expect(bar.querySelector("[data-field=select]")).not.toBeNull();
    expect(bar.querySelector("[data-action=load]")).not.toBeNull();
    expect(bar.querySelector("[data-field=name]")).toBeNull();
    expect(bar.querySelector("[data-action=save-new]")).toBeNull();
    expect(bar.querySelector("[data-action=update]")).toBeNull();
  });

  it("save mode shows the picker + save + update, but no Load", () => {
    const h = handlers();
    const bar = ProfileBar({ profiles, mode: "save", loadedName: "Alpha", ...h });
    expect(bar.querySelector("[data-field=select]")).not.toBeNull(); // pick which to overwrite
    expect(bar.querySelector("[data-action=load]")).toBeNull(); // no loading at the save step
    expect(bar.querySelector("[data-field=name]")).not.toBeNull();
    expect(bar.querySelector("[data-action=save-new]")).not.toBeNull();
    expect(bar.querySelector("[data-action=update]")).not.toBeNull();
  });

  it("update overwrites the profile selected in the picker", () => {
    const h = handlers();
    const bar = ProfileBar({ profiles, mode: "save", ...h });
    const sel = get<HTMLSelectElement>(bar, "[data-field=select]");
    sel.value = "Beta";
    get<HTMLButtonElement>(bar, "[data-action=update]").click();
    expect(h.onUpdate).toHaveBeenCalledWith("Beta");
  });

  it("renders model and family profiles in separate labelled optgroups", () => {
    const h = handlers();
    const bar = ProfileBar({
      profiles: { model: [{ name: "Mine" }], family: [{ name: "Shared" }] },
      modelLabel: "This ROG Ally X",
      familyLabel: "Other compatible devices",
      ...h,
    });
    const groups = [...bar.querySelectorAll("optgroup")];
    expect(groups.map((g) => g.label)).toEqual(["This ROG Ally X", "Other compatible devices"]);
    expect(groups[0]?.querySelector("option")?.value).toBe("Mine");
    expect(groups[1]?.querySelector("option")?.value).toBe("Shared");
  });
});

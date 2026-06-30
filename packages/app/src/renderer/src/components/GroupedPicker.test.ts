// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { GroupedPicker, type PickerGroup } from "./GroupedPicker";

const get = <T extends Element>(r: Element, s: string): T => {
  const found = r.querySelector<T>(s);
  if (!found) throw new Error(`element not found: ${s}`);
  return found;
};
const all = <T extends Element>(r: Element, s: string): T[] => [...r.querySelectorAll<T>(s)];
const fire = (el: Element, t: string) => el.dispatchEvent(new Event(t, { bubbles: true }));

const groups: PickerGroup[] = [
  {
    id: "media",
    label: "Media",
    open: true,
    items: [
      { id: "vlc", label: "VLC", sublabel: "org.videolan.VLC", checked: true },
      { id: "spotify", label: "Spotify", checked: false },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    note: "Handy extras.",
    items: [{ id: "7zip", label: "7-Zip", checked: false }],
  },
];

describe("GroupedPicker", () => {
  it("renders a group per group and an item per item, respecting open state", () => {
    const root = GroupedPicker({ groups, onToggleItem: vi.fn(), onToggleGroup: vi.fn() });
    expect(all(root, "details.app-group")).toHaveLength(2);
    expect(all(root, ".app-row")).toHaveLength(3);
    expect(get<HTMLDetailsElement>(root, '[data-group="media"]').open).toBe(true);
    expect(get<HTMLDetailsElement>(root, '[data-group="tools"]').open).toBe(false);
  });

  it("shows the group count + indeterminate state from the items", () => {
    const root = GroupedPicker({ groups, onToggleItem: vi.fn(), onToggleGroup: vi.fn() });
    const media = get<HTMLDetailsElement>(root, '[data-group="media"]');
    expect(get(media, ".app-group-count").textContent).toBe("1 / 2");
    expect(get<HTMLInputElement>(media, ".app-group-check").indeterminate).toBe(true);
    expect(get<HTMLInputElement>(media, ".app-group-check").checked).toBe(false);
  });

  it("renders the sublabel, note and icon when provided", () => {
    const icon = document.createElement("img");
    const root = GroupedPicker({
      groups: [{ id: "g", label: "G", items: [{ id: "a", label: "A", checked: false, icon }] }],
      onToggleItem: vi.fn(),
      onToggleGroup: vi.fn(),
    });
    expect(get(root, ".app-row").contains(icon)).toBe(true);
    const withNote = GroupedPicker({ groups, onToggleItem: vi.fn(), onToggleGroup: vi.fn() });
    expect(get(withNote, '[data-group="tools"] .app-note').textContent).toBe("Handy extras.");
    expect(get(withNote, '[data-group="media"] .app-id').textContent).toBe("org.videolan.VLC");
  });

  it("emits onToggleItem and updates the group head without a re-render", () => {
    const onToggleItem = vi.fn();
    const root = GroupedPicker({ groups, onToggleItem, onToggleGroup: vi.fn() });
    const media = get<HTMLDetailsElement>(root, '[data-group="media"]');
    const spotify = get<HTMLInputElement>(media, '[data-item="spotify"]');
    spotify.checked = true;
    fire(spotify, "change");
    expect(onToggleItem).toHaveBeenCalledWith("media", "spotify", true);
    // Head now reflects 2/2 → checked, not indeterminate (self-maintained).
    expect(get(media, ".app-group-count").textContent).toBe("2 / 2");
    expect(get<HTMLInputElement>(media, ".app-group-check").checked).toBe(true);
    expect(get<HTMLInputElement>(media, ".app-group-check").indeterminate).toBe(false);
  });

  it("select-all ticks every item and emits onToggleGroup", () => {
    const onToggleGroup = vi.fn();
    const root = GroupedPicker({ groups, onToggleItem: vi.fn(), onToggleGroup });
    const media = get<HTMLDetailsElement>(root, '[data-group="media"]');
    const head = get<HTMLInputElement>(media, ".app-group-check");
    head.checked = true;
    fire(head, "change");
    expect(onToggleGroup).toHaveBeenCalledWith("media", true);
    expect(all<HTMLInputElement>(media, ".app-check").every((c) => c.checked)).toBe(true);
    expect(get(media, ".app-group-count").textContent).toBe("2 / 2");
  });

  it("reports expand/collapse via onToggleOpen", () => {
    const onToggleOpen = vi.fn();
    const root = GroupedPicker({
      groups,
      onToggleItem: vi.fn(),
      onToggleGroup: vi.fn(),
      onToggleOpen,
    });
    const tools = get<HTMLDetailsElement>(root, '[data-group="tools"]');
    tools.open = true;
    fire(tools, "toggle");
    expect(onToggleOpen).toHaveBeenCalledWith("tools", true);
  });
});

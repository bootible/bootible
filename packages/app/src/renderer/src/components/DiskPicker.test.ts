// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { DiskPicker, type DiskRow } from "./DiskPicker";

const flush = () => new Promise((r) => setTimeout(r, 0));
const rows: DiskRow[] = [
  { number: 1, name: "SanDisk", sizeGb: 32, letters: "E:", label: "BOOTIBLE" },
  { number: 2, name: "Generic", sizeGb: 64, letters: "", label: "" }, // no drive letter
];

describe("DiskPicker", () => {
  it("shows a loading state, then the disks", async () => {
    const { root, refresh } = DiskPicker({
      fetch: async () => rows,
      mode: "letter",
      selected: "",
      onSelect: vi.fn(),
    });
    const p = refresh();
    expect(root.querySelector(".status-loading")).not.toBeNull();
    await p;
    expect(root.querySelectorAll(".uw-disk")).toHaveLength(2);
  });

  it("shows an empty state when no disks", async () => {
    const { root, refresh } = DiskPicker({
      fetch: async () => [],
      mode: "letter",
      selected: "",
      onSelect: vi.fn(),
    });
    await refresh();
    expect(root.querySelector(".status-empty")).not.toBeNull();
  });

  it("shows error-with-retry when the fetch throws, and retry re-fetches", async () => {
    let calls = 0;
    const { root, refresh } = DiskPicker({
      fetch: async () => {
        calls++;
        if (calls === 1) throw new Error("boom");
        return rows;
      },
      mode: "letter",
      selected: "",
      onSelect: vi.fn(),
    });
    await refresh();
    const retry = root.querySelector(".status-retry");
    expect(retry).not.toBeNull();
    (retry as HTMLElement).dispatchEvent(new Event("click", { bubbles: true }));
    await flush();
    expect(root.querySelectorAll(".uw-disk")).toHaveLength(2);
  });

  it("in letter mode disables a disk with no drive letter and selects by letter", async () => {
    const onSelect = vi.fn();
    const { root, refresh } = DiskPicker({
      fetch: async () => rows,
      mode: "letter",
      selected: "",
      onSelect,
    });
    await refresh();
    const btns = [...root.querySelectorAll<HTMLButtonElement>(".uw-disk")];
    expect(btns[0]?.dataset.diskKey).toBe("E");
    expect(btns[1]?.disabled).toBe(true); // no drive letter
    btns[0]?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith("E");
    expect(btns[0]?.classList.contains("is-sel")).toBe(true);
  });

  it("in number mode keys by disk number and allows a letterless disk", async () => {
    const onSelect = vi.fn();
    const { root, refresh } = DiskPicker({
      fetch: async () => rows,
      mode: "number",
      selected: "",
      onSelect,
    });
    await refresh();
    const btns = [...root.querySelectorAll<HTMLButtonElement>(".uw-disk")];
    expect(btns[0]?.dataset.diskKey).toBe("1");
    expect(btns[1]?.disabled).toBe(false); // flash uses the whole disk; no letter needed
    btns[1]?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith("2");
  });
});

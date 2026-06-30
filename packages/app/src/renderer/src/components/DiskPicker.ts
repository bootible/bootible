import { el } from "../lib/dom";
import { StatusMessage } from "./StatusMessage";

/** A removable disk as the main process enumerates it (Get-Disk). */
export interface DiskRow {
  number: number;
  name: string;
  sizeGb: number;
  letters: string;
  label: string;
}

export interface DiskPickerOptions {
  /** Fetch the current removable disks (window.bootible.getUsbDisks). */
  fetch(): Promise<DiskRow[]>;
  /** What a selection is keyed by: a drive letter (provision/copy) or the whole
   *  disk number (flash/reimage). */
  mode: "letter" | "number";
  /** The currently-selected key (letter like "E", or a disk number as a string). */
  selected: string;
  /** A disk was picked — the key matches `mode`. */
  onSelect(key: string): void;
}

/** The drive letter for a disk ("E"), or "" if it has none. */
function letterOf(disk: DiskRow): string {
  return (disk.letters.match(/[A-Za-z](?=:)/)?.[0] ?? "").toUpperCase();
}

/**
 * The shared removable-disk picker — one implementation for every "choose a USB
 * drive" step (ROG media write, Deck provision, Deck reimage), replacing three
 * hand-built renderers. Owns the four async states via StatusMessage (loading /
 * empty / error-with-retry / populated) so a failed enumeration is never shown as
 * "no drives," and the selected row, key extraction (letter vs whole-disk number),
 * and "no drive letter" guard are consistent everywhere. Returns a root plus a
 * `refresh()` the caller wires to its Refresh button.
 */
export function DiskPicker(o: DiskPickerOptions): {
  root: HTMLElement;
  refresh: () => Promise<void>;
} {
  const root = el("div", "disk-picker");

  const keyOf = (disk: DiskRow): string =>
    o.mode === "letter" ? letterOf(disk) : String(disk.number);

  const renderDisks = (disks: DiskRow[]): void => {
    if (disks.length === 0) {
      root.replaceChildren(
        StatusMessage({
          kind: "empty",
          message: "No removable USB drives found. Plug one in, then Refresh.",
        }),
      );
      return;
    }
    root.replaceChildren(
      ...disks.map((disk) => {
        const letter = letterOf(disk);
        const key = keyOf(disk);
        const usable = o.mode === "number" || letter !== "";
        const btn = el("button", "uw-disk") as HTMLButtonElement;
        btn.type = "button";
        btn.dataset.diskKey = key;
        btn.disabled = !usable;
        if (usable && key === o.selected) btn.classList.add("is-sel");
        const title =
          disk.label && disk.letters
            ? `${disk.label} (${disk.letters})`
            : disk.letters || disk.name;
        const detail = [
          disk.name,
          `${disk.sizeGb} GB`,
          o.mode === "letter" && !letter ? "no drive letter — format it in Explorer first" : "",
        ]
          .filter(Boolean)
          .join(" · ");
        btn.append(el("span", "uw-disk-name", title), el("span", "uw-disk-size", detail));
        btn.addEventListener("click", () => {
          if (!usable) return;
          o.selected = key;
          for (const b of root.querySelectorAll(".uw-disk"))
            b.classList.toggle("is-sel", b === btn);
          o.onSelect(key);
        });
        return btn;
      }),
    );
  };

  const refresh = async (): Promise<void> => {
    root.replaceChildren(
      StatusMessage({ kind: "loading", message: "Scanning for removable drives…" }),
    );
    try {
      renderDisks(await o.fetch());
    } catch {
      root.replaceChildren(
        StatusMessage({
          kind: "error",
          message: "Couldn't read the connected drives.",
          onRetry: () => void refresh(),
        }),
      );
    }
  };

  return { root, refresh };
}

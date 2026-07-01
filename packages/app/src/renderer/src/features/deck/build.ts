import { hydrateDeckReimage, hydrateDeckWrite } from "./media";

// The unified "Set up your Steam Deck" build screen — the Deck mirror of the ROG
// build.ts. One tabbed view: Provision USB / Full reimage / Export. All the writer
// logic lives in media.ts keyed by element id; this only picks which tab shows.
const DECK_TABS = [
  { id: "provision", label: "Provision USB" },
  { id: "reimage", label: "Full reimage" },
  { id: "export", label: "Export" },
];

function setDeckTab(mode: string): void {
  for (const tab of document.querySelectorAll<HTMLElement>("#deckbuild-tabs .sk-tab")) {
    tab.classList.toggle("is-active", tab.dataset.deckbuild === mode);
  }
  for (const pane of document.querySelectorAll<HTMLElement>("[data-deckbuild-pane]")) {
    pane.hidden = pane.dataset.deckbuildPane !== mode;
  }
}

export function hydrateDeckBuild(): void {
  const bar = document.getElementById("deckbuild-tabs");
  if (bar) {
    bar.replaceChildren(
      ...DECK_TABS.map((t, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `sk-tab${i === 0 ? " is-active" : ""}`;
        b.dataset.deckbuild = t.id;
        b.textContent = t.label;
        return b;
      }),
    );
  }
  setDeckTab("provision");
  // Both writers key their DOM by id, so hydrating both up front is safe.
  void hydrateDeckWrite();
  void hydrateDeckReimage();
}

// Tab switching within the Deck build screen.
document.addEventListener("click", (event) => {
  const tab = (event.target as HTMLElement).closest<HTMLElement>("#deckbuild-tabs .sk-tab");
  if (tab?.dataset.deckbuild) setDeckTab(tab.dataset.deckbuild);
});

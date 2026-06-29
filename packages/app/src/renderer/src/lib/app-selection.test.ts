import { describe, expect, it } from "vitest";
import { countSelectedInView } from "./app-selection";

describe("countSelectedInView", () => {
  const visible = [{ id: "vlc" }, { id: "discord" }, { id: "chrome" }];

  it("counts only selected ids that are visible in this picker", () => {
    // retroarch (emulator) + moonlight (streaming) are selected but live on other
    // screens, so they must NOT inflate this picker's header count.
    const selected = ["vlc", "discord", "retroarch", "moonlight"];
    expect(countSelectedInView(visible, selected)).toBe(2);
  });

  it("is zero when nothing visible is selected", () => {
    expect(countSelectedInView(visible, ["retroarch"])).toBe(0);
    expect(countSelectedInView(visible, [])).toBe(0);
  });

  it("counts all when every visible app is selected", () => {
    expect(countSelectedInView(visible, ["vlc", "discord", "chrome"])).toBe(3);
  });
});

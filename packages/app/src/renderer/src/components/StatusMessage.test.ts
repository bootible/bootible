// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { StatusMessage } from "./StatusMessage";

const fire = (el: Element, t: string) => el.dispatchEvent(new Event(t, { bubbles: true }));

describe("StatusMessage", () => {
  it("renders a loading state with a default or custom message", () => {
    expect(StatusMessage({ kind: "loading" }).textContent).toContain("Loading…");
    expect(StatusMessage({ kind: "loading", message: "Scanning drives…" }).textContent).toContain(
      "Scanning drives…",
    );
  });

  it("renders an empty state with no retry button", () => {
    const root = StatusMessage({ kind: "empty", message: "No drives found." });
    expect(root.classList.contains("status-empty")).toBe(true);
    expect(root.textContent).toContain("No drives found.");
    expect(root.querySelector(".status-retry")).toBeNull();
  });

  it("renders an error with a Retry button that fires onRetry", () => {
    const onRetry = vi.fn();
    const root = StatusMessage({ kind: "error", message: "Couldn't load.", onRetry });
    expect(root.classList.contains("status-error")).toBe(true);
    const btn = root.querySelector(".status-retry");
    expect(btn).not.toBeNull();
    fire(btn as Element, "click");
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("omits the Retry button on an error with no handler", () => {
    const root = StatusMessage({ kind: "error", message: "Fatal." });
    expect(root.querySelector(".status-retry")).toBeNull();
  });

  it("honours a custom retry label", () => {
    const root = StatusMessage({
      kind: "error",
      message: "x",
      retryLabel: "Try again",
      onRetry: () => {},
    });
    expect(root.querySelector(".status-retry")?.textContent).toBe("Try again");
  });
});

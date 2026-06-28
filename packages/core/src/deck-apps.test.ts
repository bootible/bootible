import { describe, expect, it, vi } from "vitest";
import { fetchDeckyPlugins, flatpakRefs, passwordManagers } from "./deck-apps";

describe("flatpakRefs", () => {
  it("uses the renamed Jellyfin id", () => {
    expect(flatpakRefs(["jellyfin"])).toEqual(["org.jellyfin.JellyfinDesktop"]);
  });
});

describe("passwordManagers", () => {
  it("resolves ids and drops unknowns", () => {
    expect(passwordManagers(["1password", "nope"]).map((p) => p.id)).toEqual(["1password"]);
  });
});

describe("fetchDeckyPlugins", () => {
  const store = [
    {
      name: "PowerTools",
      author: "a",
      description: "d",
      tags: ["t"],
      visible: true,
      downloads: 10,
      image_url: "img",
      versions: [{ name: "1.0", hash: "h" }],
    },
    { name: "Hidden", visible: false, downloads: 99, versions: [{ name: "1", hash: "x" }] },
    { name: "Popular", visible: true, downloads: 500, versions: [{ name: "2", hash: "y" }] },
  ];

  it("projects visible plugins for the picker, sorted by downloads", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(store)));
    const plugins = await fetchDeckyPlugins(fetchImpl as unknown as typeof fetch);
    expect(plugins.map((p) => p.name)).toEqual(["Popular", "PowerTools"]); // Hidden dropped, sorted
    expect(plugins[1]).toMatchObject({ author: "a", version: "1.0", imageUrl: "img" });
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 503 }));
    await expect(fetchDeckyPlugins(fetchImpl as unknown as typeof fetch)).rejects.toThrow("503");
  });
});

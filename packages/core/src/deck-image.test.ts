import { describe, expect, it } from "vitest";
import { DECK_IMAGE_INDEX, resolveDeckImage } from "./deck-image";

// Trimmed real index markup (Apache autoindex): each row is an <a href> with the
// .img.bz2 and .img.zip variants, plus the legacy dateless recovery-N images.
const INDEX = `
<tr><td class="link"><a href="../">Parent directory/</a></td></tr>
<tr><td class="link"><a href="steamdeck-oobe-repair-20260618.10-3.8.10.img.bz2" title="x">x</a></td></tr>
<tr><td class="link"><a href="steamdeck-oobe-repair-20260618.10-3.8.10.img.zip" title="x">x</a></td></tr>
<tr><td class="link"><a href="steamdeck-repair-20250521.10-3.7.7.img.zip" title="x">x</a></td></tr>
<tr><td class="link"><a href="steamdeck-recovery-4.img.zip" title="x">x</a></td></tr>
`;

describe("resolveDeckImage", () => {
  it("picks the newest .img.zip by embedded date", () => {
    const img = resolveDeckImage(INDEX);
    expect(img?.name).toBe("steamdeck-oobe-repair-20260618.10-3.8.10.img.zip");
    expect(img?.url).toBe(`${DECK_IMAGE_INDEX}steamdeck-oobe-repair-20260618.10-3.8.10.img.zip`);
  });

  it("never returns a .bz2 (we want the natively-unzippable .zip)", () => {
    expect(resolveDeckImage(INDEX)?.name).not.toContain(".bz2");
  });

  it("ranks the dateless legacy recovery-N images below dated builds", () => {
    const onlyOld = `<a href="steamdeck-recovery-2.img.zip">x</a><a href="steamdeck-recovery-4.img.zip">x</a>`;
    // no dated build → falls back to whatever's present (still a valid .img.zip)
    expect(resolveDeckImage(onlyOld)?.name).toMatch(/^steamdeck-recovery-\d\.img\.zip$/);
  });

  it("returns null when there is no .img.zip", () => {
    expect(resolveDeckImage('<a href="readme.txt">x</a>')).toBeNull();
    expect(resolveDeckImage("")).toBeNull();
  });
});

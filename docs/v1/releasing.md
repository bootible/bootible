# Releasing bootible

The one-liner (`irm bootible.dev/rog | iex`) serves two channels from the Cloudflare
worker (`cloudflare/_worker.js`):

- **Stable** (`/rog`, `/deck`, `/android`): serves `STABLE_REF`, a git ref pinned in
  the worker at deploy time (a release tag once a release exists; `'main'` before the
  first release). When a tag is served, content is verified against the route's
  `sha256Stable` checksum; when `STABLE_REF` is `'main'`, against `sha256`. No runtime
  API lookups — the channel cannot silently drift.
- **Beta** (`/rog-beta`, `/deck-beta`, `/android-beta`): always serves main, verified
  against the route's `sha256` checksum. The Update Checksums workflow
  (`.github/workflows/update-checksums.yml`) keeps `sha256` synced to main
  automatically; it never touches `STABLE_REF` or `sha256Stable`.

The worker is redeployed automatically whenever `cloudflare/_worker.js` changes on
main (Cloudflare Pages deploys on push). A release activates atomically when the
step-4 commit deploys: `STABLE_REF` and the `sha256Stable` checksums flip together in
one commit, so there is no window where the worker requests a tag whose checksums
are not pinned — the previous release keeps serving until the deploy lands.

## Release steps

1. Ensure main is green (CI: Pester, PSScriptAnalyzer, checksums, lints).
2. Set the version constants for the tag:
   - `targets/ally.ps1`: `$Script:BootibleRef = "vX.Y.Z"`
   - `config/rog-ally/Run.ps1`: `$Script:BootibleVersion = "X.Y.Z"`
   Commit: `chore(release): vX.Y.Z`. Push and wait for the Update Checksums workflow
   to re-sync the beta `sha256` fields (it commits to main; pull before tagging).
3. Tag the checksum-synced commit and push: `git tag vX.Y.Z && git push origin main vX.Y.Z`.
   Create the GitHub release with notes: `gh release create vX.Y.Z --generate-notes`.
4. Activate the release on the stable channel — ONE commit on main that changes both:
   - `STABLE_REF = 'vX.Y.Z'` in `cloudflare/_worker.js`
   - each route's `sha256Stable`, set to the tag's target-script hashes:
     ```bash
     git worktree add /tmp/bootible-vX.Y.Z vX.Y.Z
     (cd /tmp/bootible-vX.Y.Z && ./scripts/update-checksums.sh)
     git worktree remove /tmp/bootible-vX.Y.Z
     ```
   Commit: `chore(release): activate vX.Y.Z on the stable channel`. The push
   auto-deploys the worker; the stable channel now serves vX.Y.Z.
5. Reopen main: set both constants back to `"main"`.
   Commit: `chore: reopen main for development`.
   The Update Checksums workflow will re-sync the beta `sha256` fields automatically;
   it only rewrites `sha256` inside each route block and does not touch `STABLE_REF`
   or `sha256Stable`. Do this promptly: between steps 2 and 5, beta bootstraps fetch
   an ally.ps1 whose `$Script:BootibleRef` points at the tag, so a device
   bootstrapped from `-beta` in that window checks out the release instead of main.
6. Verify both channels. `irm | iex` cannot see response headers, so check the
   served ref directly:
   ```powershell
   (Invoke-WebRequest https://bootible.dev/rog).Headers['X-Bootible-Ref']      # the tag
   (Invoke-WebRequest https://bootible.dev/rog-beta).Headers['X-Bootible-Ref'] # main
   ```
   Then `irm https://bootible.dev/rog | iex` on a test machine reports the
   released version.

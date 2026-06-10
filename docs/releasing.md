# Releasing bootible

The one-liner (`irm bootible.dev/rog | iex`) serves two channels from the Cloudflare
worker (`cloudflare/_worker.js`):

- **Stable** (`/rog`, `/deck`, `/android`): the worker resolves the latest GitHub
  release tag via the GitHub API (5-minute cache, fallback to main when no release
  exists or the API is down) and serves that ref. Content is verified against the
  route's `sha256Stable` checksum when a tag is served, or `sha256` when the resolver
  falls back to main.
- **Beta** (`/rog-beta`, `/deck-beta`, `/android-beta`): always serves main, verified
  against the route's `sha256` checksum. The Update Checksums workflow
  (`.github/workflows/update-checksums.yml`) keeps `sha256` synced to main
  automatically; it never touches `sha256Stable`.

The worker is redeployed automatically whenever `cloudflare/_worker.js` changes on
main (Cloudflare Pages deploys on push) — pinning the stable checksums (step 4) is
what activates a release for the stable channel.

## Release steps

1. Ensure main is green (CI: Pester, PSScriptAnalyzer, checksums, lints).
2. Set the version constants for the tag:
   - `targets/ally.ps1`: `$Script:BootibleRef = "vX.Y.Z"`
   - `config/rog-ally/Run.ps1`: `$Script:BootibleVersion = "X.Y.Z"`
   Commit: `chore(release): vX.Y.Z`. Push and wait for the Update Checksums workflow
   to re-sync the beta `sha256` fields (it commits to main; pull before tagging).
3. Tag the checksum-synced commit and push: `git tag vX.Y.Z && git push origin main vX.Y.Z`.
   Create the GitHub release with notes: `gh release create vX.Y.Z --generate-notes`.
4. Pin the stable checksums on main to the tag's content:
   ```bash
   git worktree add /tmp/bootible-vX.Y.Z vX.Y.Z
   (cd /tmp/bootible-vX.Y.Z && ./scripts/update-checksums.sh)
   git worktree remove /tmp/bootible-vX.Y.Z
   ```
   Copy each printed hash into the matching route's `sha256Stable` field in
   `cloudflare/_worker.js`. Commit: `chore(release): pin stable checksums for vX.Y.Z`.
   The push auto-deploys the worker; the stable channel now serves vX.Y.Z.
5. Reopen main: set both constants back to `"main"`.
   Commit: `chore: reopen main for development`.
   The Update Checksums workflow will re-sync the beta `sha256` fields automatically;
   it only rewrites `sha256` inside each route block and does not touch `sha256Stable`.
6. Verify both channels: `irm https://bootible.dev/rog | iex` on a test machine
   reports the released version (check the `X-Bootible-Ref` response header is the
   tag); `bootible.dev/rog-beta` still serves main.

Note: the worker resolves *which* tag is latest at request time (no deploy needed for
that), but `sha256Stable` is baked into the deployed worker — a release is not live on
the stable channel until step 4's commit has pushed and deployed.

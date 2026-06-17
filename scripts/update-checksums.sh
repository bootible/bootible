#!/bin/bash
# Generate SHA256 checksums for Cloudflare worker integrity verification
# Run this after modifying targets/ally.ps1, targets/deck.sh, or targets/android.sh
#
# The worker has two checksum fields per route:
#   sha256       - beta channel (main); auto-updated by .github/workflows/update-checksums.yml
#   sha256Stable - stable channel; pinned by the release process (see docs/v1/releasing.md)
# Run this script from a checkout of the ref you are pinning (main for beta,
# the release tag for stable).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$REPO_ROOT"

# Calculate hashes
ALLY_HASH=$(sha256sum targets/ally.ps1 | cut -d' ' -f1)
DECK_HASH=$(sha256sum targets/deck.sh | cut -d' ' -f1)
ANDROID_HASH=$(sha256sum targets/android.sh | cut -d' ' -f1)

echo "SHA256 Checksums for cloudflare/_worker.js"
echo "==========================================="
echo ""
echo "Update the matching field in the ROUTES object:"
echo "  - 'sha256' if this checkout is main (beta channel)"
echo "  - 'sha256Stable' if this checkout is a release tag (stable channel)"
echo ""
echo "  '/rog'     (targets/ally.ps1):   $ALLY_HASH"
echo "  '/deck'    (targets/deck.sh):    $DECK_HASH"
echo "  '/android' (targets/android.sh): $ANDROID_HASH"
echo ""
echo "IMPORTANT: Deploy scripts and worker together to avoid integrity failures."

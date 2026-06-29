#!/usr/bin/env bash
# deploy-site.sh
# Sync the entire staplegames.com website from this repo to its dedicated CDN.
#
# Bucket:        staplegames-website-cloudfront   (private; CloudFront reads via OAC)
# Distribution:  E1IX16L22OJTVL                   (aliases: staplegames.com, www.staplegames.com)
# Public URL:    https://staplegames.com          (post-DNS-cutover)
#                https://<dist-domain>.cloudfront.net (pre-cutover smoke test)
#
# Usage:
#   ./_scripts/deploy-site.sh              # real deploy
#   ./_scripts/deploy-site.sh --dryrun     # show what would change, upload nothing
#
# Requires: aws CLI configured with creds that can:
#   - s3:ListBucket on staplegames-website-cloudfront
#   - s3:GetObject / PutObject / DeleteObject on staplegames-website-cloudfront/*
#   - cloudfront:CreateInvalidation / GetInvalidation on the distribution above
#
# Notes:
#   - The bucket uses Object Ownership = "Bucket owner enforced" + OAC, so
#     uploads do NOT need --acl public-read (and would fail if they tried).
#   - HTML is short-cached (5 min) so changes appear fast after invalidation.
#     Assets are long-cached (1 hr) and refreshed by the invalidation as well.
#   - --delete is used in both passes, scoped by the include/exclude filters,
#     so removing a file locally cleans it up in S3.

set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
BUCKET="staplegames-website-cloudfront"
DISTRIBUTION_ID="E1IX16L22OJTVL"

HTML_CACHE="public, max-age=300, must-revalidate"
ASSET_CACHE="public, max-age=3600"

# ── Flags ────────────────────────────────────────────────────────────────────
DRYRUN=""
if [[ "${1:-}" == "--dryrun" ]]; then
  DRYRUN="--dryrun"
  echo "[deploy] DRY RUN — no objects will be uploaded, deleted, or invalidated."
  echo ""
fi

# ── Resolve repo root ────────────────────────────────────────────────────────
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$REPO_ROOT"

# ── Pre-flight ───────────────────────────────────────────────────────────────
if ! command -v aws >/dev/null 2>&1; then
  echo "bderr: aws CLI not found in PATH" >&2
  exit 1
fi
if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "bderr: AWS credentials not configured" >&2
  exit 1
fi

# ── Excludes (applied to every sync pass) ────────────────────────────────────
# What we DON'T publish to the CDN:
#   _scripts/                       deploy tooling
#   _plans/                         migration / roadmap docs
#   .git/, .github/, .gitignore     git internals
#   .DS_Store, .playwright-mcp/     local dev cruft
#   CNAME                           GitHub Pages-only; no purpose on CloudFront
#   README.md, *.md                 repo docs
#   og-image-instructions.txt       internal note
#   dev/                            HP backups / work-in-progress
#
# NOTE: eval-*/ and eval-*.html ARE published here. They also live on
# cdn.bdz5.com via their own deploy scripts; staplegames.com hosting them as
# well is intentional (same content, two URLs).
COMMON_EXCLUDES=(
  --exclude "_scripts/*"
  --exclude "_plans/*"
  --exclude ".git/*"
  --exclude ".github/*"
  --exclude ".gitignore"
  --exclude ".DS_Store"
  --exclude "**/.DS_Store"
  --exclude ".playwright-mcp/*"
  --exclude "CNAME"
  --exclude "README.md"
  --exclude "**/README.md"
  --exclude "*.md"
  --exclude "og-image-instructions.txt"
  --exclude "dev/*"
)

# ── Step 1: assets (long cache) ──────────────────────────────────────────────
# Everything EXCEPT html. --delete cleans up removed files; the *.html
# exclude here means HTML files in S3 are NOT touched in this pass.
echo "[deploy] step 1: syncing non-HTML assets (cache: $ASSET_CACHE)"
aws s3 sync . "s3://$BUCKET/" \
  "${COMMON_EXCLUDES[@]}" \
  --exclude "*.html" \
  --delete \
  --cache-control "$ASSET_CACHE" \
  $DRYRUN

# ── Step 2: HTML (short cache, explicit content-type) ────────────────────────
# Only HTML this pass. --delete here cleans up any HTML that was removed
# from the repo (e.g., a renamed page).
#
# Filter order matters: aws s3 sync applies --include/--exclude in order, and
# the LAST matching rule wins. We must first exclude everything, re-include
# *.html, and THEN re-apply the path-based excludes so that things like
# dev/index.html and eval-*/index.html aren't picked back up by the *.html
# wildcard.
echo ""
echo "[deploy] step 2: syncing HTML (cache: $HTML_CACHE)"
aws s3 sync . "s3://$BUCKET/" \
  --exclude "*" --include "*.html" \
  "${COMMON_EXCLUDES[@]}" \
  --delete \
  --cache-control "$HTML_CACHE" \
  --content-type "text/html; charset=utf-8" \
  $DRYRUN

# ── Step 3: invalidate CloudFront ────────────────────────────────────────────
# Full-site invalidation. First 1000 paths/month are free; "/*" counts as 1.
if [[ -n "$DRYRUN" ]]; then
  echo ""
  echo "[deploy] step 3 (skipped in dry-run): would invalidate /* on $DISTRIBUTION_ID"
  echo ""
  echo "[deploy] dry run complete."
  exit 0
fi

echo ""
echo "[deploy] step 3: invalidating CloudFront cache for /*"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo ""
echo "[deploy] done."
echo "[deploy] invalidation: $INVALIDATION_ID (~5 min for global propagation)"
echo "[deploy] verify at:    https://<dist-domain>.cloudfront.net/  (pre-cutover)"
echo "                       https://staplegames.com/                (post-cutover)"

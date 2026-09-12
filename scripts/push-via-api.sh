#!/bin/sh
# Push the working tree to GitHub using the REST API through `gh`.
# Fallback for machines where system git is unavailable.
# Usage: scripts/push-via-api.sh OWNER/REPO BRANCH "commit message"
set -eu
REPO="$1"; BRANCH="$2"; MSG="$3"
cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"
: > "$TMP/tree.jsonl"
find . -type f ! -path './.git/*' ! -name '*.log' ! -name '.DS_Store' ! -path './node_modules/*' | sed 's|^\./||' | sort | while IFS= read -r f; do
  mode=100644; [ -x "$f" ] && mode=100755
  sha=$(base64 < "$f" | tr -d '\n' | jq -Rs '{content: ., encoding: "base64"}' \
        | gh api "repos/$REPO/git/blobs" --input - -q .sha)
  printf '{"path":"%s","mode":"%s","type":"blob","sha":"%s"}\n' "$f" "$mode" "$sha" >> "$TMP/tree.jsonl"
  echo "blob $f"
done
PARENT=$(gh api "repos/$REPO/git/ref/heads/$BRANCH" -q .object.sha 2>/dev/null || true)
if [ -n "$PARENT" ]; then
  BASE=$(gh api "repos/$REPO/git/commits/$PARENT" -q .tree.sha)
  TREE=$(jq -s --arg base "$BASE" '{base_tree: $base, tree: .}' "$TMP/tree.jsonl" | gh api "repos/$REPO/git/trees" --input - -q .sha)
  COMMIT=$(jq -n --arg m "$MSG" --arg t "$TREE" --arg p "$PARENT" '{message:$m, tree:$t, parents:[$p]}' | gh api "repos/$REPO/git/commits" --input - -q .sha)
  jq -n --arg s "$COMMIT" '{sha:$s, force:false}' | gh api -X PATCH "repos/$REPO/git/refs/heads/$BRANCH" --input - -q .ref
else
  TREE=$(jq -s '{tree: .}' "$TMP/tree.jsonl" | gh api "repos/$REPO/git/trees" --input - -q .sha)
  COMMIT=$(jq -n --arg m "$MSG" --arg t "$TREE" '{message:$m, tree:$t, parents:[]}' | gh api "repos/$REPO/git/commits" --input - -q .sha)
  jq -n --arg r "refs/heads/$BRANCH" --arg s "$COMMIT" '{ref:$r, sha:$s}' | gh api "repos/$REPO/git/refs" --input - -q .ref
fi
echo "pushed $COMMIT to $REPO@$BRANCH"
rm -rf "$TMP"

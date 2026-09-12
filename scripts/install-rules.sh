#!/bin/sh
# Install opm rules into a repository's .claude/rules/opm/ directory.
# Usage: install-rules.sh [--langs typescript,react] [--force] <target-repo>
set -eu

usage() {
  echo "Usage: $0 [--langs <lang>[,<lang>...]] [--force] <target-repo>" >&2
  echo "Available languages: typescript react python dart" >&2
  exit 1
}

script_dir=$(cd "$(dirname "$0")" && pwd)
rules_dir="$script_dir/../rules"
langs=""
force=0
target=""

while [ $# -gt 0 ]; do
  case "$1" in
    --langs) [ $# -ge 2 ] || usage; langs="$2"; shift 2 ;;
    --force) force=1; shift ;;
    -h|--help) usage ;;
    -*) echo "Unknown option: $1" >&2; usage ;;
    *) [ -z "$target" ] || usage; target="$1"; shift ;;
  esac
done

[ -n "$target" ] || usage
[ -d "$target" ] || { echo "Target is not a directory: $target" >&2; exit 1; }
[ -d "$rules_dir/common" ] || { echo "Rules not found at $rules_dir" >&2; exit 1; }

dirs="common"
for lang in $(printf '%s' "$langs" | tr ',' ' '); do
  [ -d "$rules_dir/$lang" ] || { echo "Unknown language: $lang" >&2; usage; }
  dirs="$dirs $lang"
done

dest="$target/.claude/rules/opm"
if [ -e "$dest" ] && [ "$force" -eq 0 ]; then
  echo "Refusing to overwrite existing $dest (use --force)" >&2
  exit 1
fi

[ "$force" -eq 1 ] && [ -e "$dest" ] && rm -rf "$dest"
mkdir -p "$dest"

count=0
for dir in $dirs; do
  cp -R "$rules_dir/$dir" "$dest/"
  n=$(find "$dest/$dir" -name '*.md' | wc -l | tr -d ' ')
  count=$((count + n))
  echo "installed $dir/ ($n files)"
done

echo "Done: $count rule files in $dest"

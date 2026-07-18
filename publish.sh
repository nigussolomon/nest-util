#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: ./publish.sh <pkg>"
  echo
  echo "  pkg: auth | crud | audit | file | ncnu | full (all packages)"
  echo
  echo "  NPM_TOKEN env var must be set with a valid npm registry token."
  exit 1
}

PKG="${1:-}"

if [ -z "${NPM_TOKEN:-}" ]; then
  echo "ERROR: NPM_TOKEN environment variable is not set."
  echo
  usage
fi

if [ "$PKG" = "full" ]; then
  for p in auth crud audit file ncnu; do
    "$0" "$p"
  done
  exit 0
fi

case "$PKG" in
  auth)  DIR="libs/nest-auth"  NAME="nest-auth" ;;
  crud)  DIR="libs/nest-crud"  NAME="nest-crud" ;;
  audit) DIR="libs/nest-audit" NAME="nest-audit" ;;
  file)  DIR="libs/nest-file"  NAME="nest-file" ;;
  ncnu)  DIR="libs/ncnu"       NAME="ncnu" ;;
  *)     usage ;;
esac

echo "=== Building $NAME ==="
pnpm nx build "$NAME"

echo "=== Publishing $NAME ==="
cd "$DIR"
NPM_TOKEN="$NPM_TOKEN" npm publish --access public --registry https://registry.npmjs.org/

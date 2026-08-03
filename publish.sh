#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: ./publish.sh <pkg>"
  echo
  echo "  pkg: auth | crud | file | notify | payment | full (all packages)"
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
  for p in auth crud file notify payment; do
    "$0" "$p"
  done
  exit 0
fi

case "$PKG" in
  auth)    DIR="libs/nest-auth"    NAME="nest-auth" ;;
  crud)    DIR="libs/nest-crud"    NAME="nest-crud" ;;
  file)    DIR="libs/nest-file"    NAME="nest-file" ;;
  notify)  DIR="libs/nest-notify"  NAME="nest-notify" ;;
  payment) DIR="libs/nest-payment" NAME="nest-payment" ;;
  *)       usage ;;
esac

echo "=== Building $NAME ==="
pnpm nx build "$NAME"

echo "=== Publishing $NAME ==="
cd "$DIR"
NPM_TOKEN="$NPM_TOKEN" npm publish --access public --registry https://registry.npmjs.org/

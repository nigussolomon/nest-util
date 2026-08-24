#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: ./bump.sh <pkg> [bump-type]"
  echo
  echo "  pkg:        auth | crud | file | notify | payment | error | full (all packages)"
  echo "  bump-type:  major | minor | patch (default: patch)"
  exit 1
}

run_check_gate() {
  if [ "${NEST_UTIL_SKIP_GATE:-}" = "1" ]; then
    return 0
  fi
  if [ "${SKIP_CHECK:-}" = "1" ]; then
    echo "SKIP_CHECK=1 set — skipping pnpm check gate."
    return 0
  fi
  echo "=== Running pnpm check gate ==="
  pnpm check
}

PKG="${1:-}"
BUMP="${2:-patch}"

if [ "$PKG" = "full" ]; then
  case "$BUMP" in
    major|minor|patch) ;;
    *) usage ;;
  esac
  run_check_gate
  for p in auth crud file notify payment error; do
    NEST_UTIL_SKIP_GATE=1 "$0" "$p" "$BUMP"
  done
  exit 0
fi

case "$PKG" in
  auth)    FILE="libs/nest-auth/package.json" ;;
  crud)    FILE="libs/nest-crud/package.json" ;;
  file)    FILE="libs/nest-file/package.json" ;;
  notify)  FILE="libs/nest-notify/package.json" ;;
  payment) FILE="libs/nest-payment/package.json" ;;
  error)   FILE="libs/nest-error/package.json" ;;
  *)       usage ;;
esac

case "$BUMP" in
  major|minor|patch) ;;
  *) usage ;;
esac

run_check_gate

node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$FILE', 'utf8'));
const [maj, min, pat] = pkg.version.split('.').map(Number);

let nmaj = maj, nmin = min, npat = pat;
switch ('$BUMP') {
  case 'major': nmaj = maj + 1; nmin = 0; npat = 0; break;
  case 'minor': nmin = min + 1; npat = 0; break;
  case 'patch': npat = pat + 1; break;
}

const oldV = pkg.version;
pkg.version = nmaj + '.' + nmin + '.' + npat;
fs.writeFileSync('$FILE', JSON.stringify(pkg, null, 2) + '\n');
console.log('$PKG: ' + oldV + ' → ' + pkg.version);
"

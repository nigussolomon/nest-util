#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: ./bump.sh <pkg> [bump-type]"
  echo
  echo "  pkg:        auth | crud | audit | file | ncnu | full (all packages)"
  echo "  bump-type:  major | minor | patch (default: patch)"
  exit 1
}

PKG="${1:-}"
BUMP="${2:-patch}"

if [ "$PKG" = "full" ]; then
  case "$BUMP" in
    major|minor|patch) ;;
    *) usage ;;
  esac
  for p in auth crud audit file ncnu; do
    "$0" "$p" "$BUMP"
  done
  exit 0
fi

case "$PKG" in
  auth)  FILE="libs/nest-auth/package.json" ;;
  crud)  FILE="libs/nest-crud/package.json" ;;
  audit) FILE="libs/nest-audit/package.json" ;;
  file)  FILE="libs/nest-file/package.json" ;;
  ncnu)  FILE="libs/ncnu/package.json" ;;
  *)     usage ;;
esac

case "$BUMP" in
  major|minor|patch) ;;
  *) usage ;;
esac

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

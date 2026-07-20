#!/usr/bin/env bash
# Local release gates — run before every push or publish.
# (Stands in for CI while GitHub Actions is unavailable; keep green regardless.)
set -euo pipefail
cd "$(dirname "$0")"

echo "── gate 1/6: secret scan"
if grep -rInE "gho_[A-Za-z0-9]|ghp_[A-Za-z0-9]|sk-[A-Za-z0-9]{20}|AKIA[A-Z0-9]{16}|PRIVATE KEY" \
  --include="*.ts" --include="*.json" --include="*.md" --include="*.yml" --include="*.sh" \
  --exclude=gates.sh --exclude=gates.ps1 \
  --exclude-dir=node_modules --exclude-dir=dist .; then
  echo "✗ potential secret found"; exit 1
fi
echo "✓ clean"

echo "── gate 2/6: typecheck"
npm run --silent typecheck

echo "── gate 3/6: tests"
npm test --silent

echo "── gate 4/6: build"
npm run --silent build

echo "── gate 5/6: CLI smoke (byte-match against a golden)"
node dist/cli.js test/fixtures/mono-sine.wav > /tmp/bravoh-peaks-cli.json
node -e '
  const fs = require("node:fs");
  const assert = require("node:assert");
  const a = JSON.parse(fs.readFileSync("/tmp/bravoh-peaks-cli.json", "utf8"));
  const b = JSON.parse(fs.readFileSync("test/golden/mono-sine.json", "utf8"));
  try { assert.deepStrictEqual(a, b); } catch { console.error("✗ CLI output diverged from golden"); process.exit(1); }
  console.log("✓ CLI receipt matches golden");
'

echo "── gate 6/6: pack sanity"
npm pack --dry-run 2>&1 | tail -6

echo ""
echo "ALL GATES GREEN ✓"

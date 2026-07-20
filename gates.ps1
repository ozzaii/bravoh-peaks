# Local release gates (Windows) — parity with gates.sh.
# Run before every push or publish while GitHub Actions is unavailable.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "-- gate 1/6: secret scan"
$pattern = 'gho_[A-Za-z0-9]|ghp_[A-Za-z0-9]|sk-[A-Za-z0-9]{20}|AKIA[A-Z0-9]{16}|PRIVATE KEY'
$hits = Get-ChildItem -Recurse -Include *.ts,*.json,*.md,*.yml,*.sh,*.ps1 |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\dist\\' -and $_.Name -notin @('gates.ps1','gates.sh') } |
  Select-String -Pattern $pattern
if ($hits) { Write-Error "potential secret found"; exit 1 }
Write-Host "clean"

Write-Host "-- gate 2/6: typecheck"
npm run --silent typecheck
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "-- gate 3/6: tests"
npm test --silent
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "-- gate 4/6: build"
npm run --silent build
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "-- gate 5/6: CLI smoke (byte-match against a golden)"
node dist/cli.js test/fixtures/mono-sine.wav > $env:TEMP\bravoh-peaks-cli.json
node -e "const fs=require('node:fs');const assert=require('node:assert');const a=JSON.parse(fs.readFileSync(process.env.TEMP+'/bravoh-peaks-cli.json','utf8'));const b=JSON.parse(fs.readFileSync('test/golden/mono-sine.json','utf8'));try{assert.deepStrictEqual(a,b)}catch{console.error('CLI output diverged from golden');process.exit(1)}console.log('CLI receipt matches golden')"
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "-- gate 6/6: pack sanity"
npm pack --dry-run

Write-Host ""
Write-Host "ALL GATES GREEN"

# Auto-detect proxy, then commit & push.
# Usage:  .\push.ps1 "your commit message"
# Leave the message empty to only push.

param([string]$Message = "")

$ErrorActionPreference = 'Continue'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
            [Environment]::GetEnvironmentVariable('Path','User')

Write-Host "=== 1. Detecting proxy ===" -ForegroundColor Cyan
$candidates = @(10090, 7890, 7891, 10809, 10808, 1080, 2080, 8080)
$found = $null
foreach ($p in $candidates) {
    $ok = Test-NetConnection -ComputerName 127.0.0.1 -Port $p -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($ok) { $found = $p; break }
}

if ($found) {
    git config --global http.proxy  "http://127.0.0.1:$found"
    git config --global https.proxy "http://127.0.0.1:$found"
    Write-Host "  Proxy found on port $found, git configured." -ForegroundColor Green
} else {
    git config --global --unset http.proxy  2>$null
    git config --global --unset https.proxy 2>$null
    Write-Host "  No proxy detected, trying direct connection." -ForegroundColor Yellow
}

Write-Host "=== 2. Checking connection to GitHub ===" -ForegroundColor Cyan
$code = & curl.exe -s -o NUL -w "%{http_code}" --max-time 15 https://github.com 2>&1
Write-Host "  github.com -> HTTP $code"
if ("$code" -notmatch '^[23]') {
    Write-Host "  CANNOT reach GitHub. Please turn on your VPN first, then run this again." -ForegroundColor Red
    exit 1
}

Write-Host "=== 3. Staging changes ===" -ForegroundColor Cyan
git add .
$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "  Nothing to commit." -ForegroundColor Yellow
} else {
    if ($staged -match '^\.env$') {
        Write-Host "  DANGER: .env is staged! Aborting." -ForegroundColor Red
        git reset > $null
        exit 1
    }
    Write-Host "  Files to commit:"
    $staged | ForEach-Object { Write-Host "    $_" }

    $msg = if ($Message) { $Message } else { "chore: update" }
    git commit -m $msg | Select-Object -First 2 | ForEach-Object { Write-Host "  $_" }
}

Write-Host "=== 4. Pushing ===" -ForegroundColor Cyan
$env:GIT_TERMINAL_PROMPT = '0'
$out = git push 2>&1 | Out-String
Write-Host $out.Trim()
if ($LASTEXITCODE -eq 0) {
    Write-Host "  PUSHED OK" -ForegroundColor Green
} else {
    Write-Host "  PUSH FAILED" -ForegroundColor Red
    exit 1
}

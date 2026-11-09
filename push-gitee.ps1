# Push local repo to Gitee.
# Usage: double-click this file, or run:
#   .\push-gitee.ps1 "https://gitee.com/your-name/After-the-Rain.git"

param([string]$RepoUrl = "")

$ErrorActionPreference = 'Continue'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' +
            [Environment]::GetEnvironmentVariable('Path','User')

Set-Location 'D:\dev\projects\deepseek-test'

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Push After-the-Rain to Gitee" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# ---- 1. get repo url ----
if (-not $RepoUrl) {
    Write-Host ""
    Write-Host "Paste your Gitee repo HTTPS url, e.g.:" -ForegroundColor Yellow
    Write-Host "  https://gitee.com/zhangsan/After-the-Rain.git" -ForegroundColor DarkGray
    Write-Host ""
    $RepoUrl = Read-Host "URL"
}

$RepoUrl = $RepoUrl.Trim()
if ($RepoUrl -notmatch '^https://gitee\.com/.+\.git$') {
    Write-Host ""
    Write-Host "  Invalid url. It must look like:" -ForegroundColor Red
    Write-Host "  https://gitee.com/your-name/After-the-Rain.git" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "  Target: $RepoUrl" -ForegroundColor Green

# ---- 2. check connectivity ----
Write-Host ""
Write-Host "[1/4] Checking gitee.com ..." -ForegroundColor Cyan
$code = & curl.exe -s -o NUL -w "%{http_code}" --max-time 15 https://gitee.com 2>&1
Write-Host "      gitee.com -> HTTP $code"
if ("$code" -notmatch '^[23]') {
    Write-Host "      Cannot reach Gitee. Check your network." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# ---- 3. configure remote ----
Write-Host "[2/4] Configuring remote 'gitee' ..." -ForegroundColor Cyan
$existing = git remote 2>$null
if ($existing -contains 'gitee') {
    git remote set-url gitee $RepoUrl 2>&1 | Out-Null
    Write-Host "      remote updated" -ForegroundColor Green
} else {
    git remote add gitee $RepoUrl 2>&1 | Out-Null
    Write-Host "      remote added" -ForegroundColor Green
}
git remote -v | Where-Object { $_ -match 'gitee' } | ForEach-Object { Write-Host "      $_" }

# ---- 4. safety check ----
Write-Host "[3/4] Safety check ..." -ForegroundColor Cyan
$tracked = git ls-files
$leak = $tracked | Where-Object { $_ -eq '.env' }
$single = $tracked | Where-Object { $_ -match '单文件版' }
if ($leak) { Write-Host "      DANGER: .env is tracked!" -ForegroundColor Red }
if ($single) { Write-Host "      DANGER: standalone html (contains keys) is tracked!" -ForegroundColor Red }
if (-not $leak -and -not $single) { Write-Host "      OK - no secrets tracked" -ForegroundColor Green }

# ---- 5. push ----
Write-Host "[4/4] Pushing ..." -ForegroundColor Cyan
Write-Host ""
Write-Host "  If a login window pops up:" -ForegroundColor Yellow
Write-Host "    Username: your Gitee username (not phone, not email)" -ForegroundColor Yellow
Write-Host "    Password: your Gitee password OR a personal access token" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Tip: Gitee needs a token if you enabled 2FA." -ForegroundColor DarkGray
Write-Host "  Create one at: https://gitee.com/profile/personal_access_tokens" -ForegroundColor DarkGray

$env:GIT_TERMINAL_PROMPT = '1'
$out = git push -u gitee main 2>&1 | Out-String
Write-Host $out

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "  PUSHED OK" -ForegroundColor Green
    Write-Host "  Repository: $RepoUrl" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "  PUSH FAILED" -ForegroundColor Red
    Write-Host "  Common causes:" -ForegroundColor Yellow
    Write-Host "    - repo does not exist yet (create it on Gitee first)" -ForegroundColor Yellow
    Write-Host "    - wrong username or password / token expired" -ForegroundColor Yellow
    Write-Host "    - repo has a README while yours has commits (use: git push -u gitee main -f)" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to exit"

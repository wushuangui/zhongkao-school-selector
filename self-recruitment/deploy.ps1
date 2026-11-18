# 打包网页并部署到 Cloudflare Pages。
# 首次使用前运行一次：npx wrangler login
# 用法：.\deploy.ps1 [-ProjectName zhongkao-zzzs] [-Refresh]
param(
    [string]$ProjectName = "zhongkao-zzzs",
    [switch]$Refresh
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$dist = Join-Path $root "dist"

if ($Refresh) {
    python (Join-Path $root "scripts\fetch_data.py")
    if ($LASTEXITCODE -ne 0) { throw "数据抓取失败" }
}

if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $dist "data"), (Join-Path $dist "css"), (Join-Path $dist "js") | Out-Null
Copy-Item (Join-Path $root "index.html") $dist
Copy-Item (Join-Path $root "css\style.css") (Join-Path $dist "css")
Copy-Item (Join-Path $root "js\app.js") (Join-Path $dist "js")
Copy-Item (Join-Path $root "js\guide.js") (Join-Path $dist "js")
Copy-Item (Join-Path $root "js\rules.js") (Join-Path $dist "js")
Copy-Item (Join-Path $root "data\zzzs-data.js") (Join-Path $dist "data")
Copy-Item (Join-Path $root "data\scores-data.js") (Join-Path $dist "data")
# 页面资源和数据不缓存，重新部署后打开即是最新内容
Set-Content -Path (Join-Path $dist "_headers") -Encoding utf8 -Value @"
/data/*
  Cache-Control: no-cache
/css/*
  Cache-Control: no-cache
/js/*
  Cache-Control: no-cache
"@

$projects = npx --yes wrangler pages project list 2>&1 | Out-String
if ($projects -notmatch [regex]::Escape($ProjectName)) {
    npx --yes wrangler pages project create $ProjectName --production-branch main
    if ($LASTEXITCODE -ne 0) { throw "创建 Cloudflare Pages 项目失败" }
}

npx --yes wrangler pages deploy $dist --project-name $ProjectName --branch main --commit-dirty=true
if ($LASTEXITCODE -ne 0) { throw "部署失败" }
Write-Host "`n部署完成：https://$ProjectName.pages.dev" -ForegroundColor Green

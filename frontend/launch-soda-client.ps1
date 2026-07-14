$ErrorActionPreference = 'Stop'

$clientDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputsDir = Split-Path -Parent $clientDir
$repoRoot = Split-Path -Parent $outputsDir
$apiDir = Join-Path $repoRoot 'work\github-sync\backend'
$webDir = Join-Path $repoRoot 'work\github-sync\frontend'
$apiUrl = 'http://127.0.0.1:3000/server/now'
$webUrl = 'http://127.0.0.1:3001/index.html'

function Test-UrlReady {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Wait-UrlReady {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [int]$RetryCount = 30,
    [int]$DelayMs = 500
  )

  for ($i = 0; $i -lt $RetryCount; $i++) {
    if (Test-UrlReady -Url $Url) {
      return $true
    }
    Start-Sleep -Milliseconds $DelayMs
  }

  return $false
}

function Start-HiddenNodeProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  Start-Process -FilePath 'node' -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -WindowStyle Hidden | Out-Null
}

if (-not (Test-Path -LiteralPath $apiDir)) {
  throw "Backend directory not found: $apiDir"
}

if (-not (Test-Path -LiteralPath $webDir)) {
  throw "Frontend directory not found: $webDir"
}

if (-not (Test-UrlReady -Url $apiUrl)) {
  Start-HiddenNodeProcess -WorkingDirectory $apiDir -Arguments @('app.js')
  if (-not (Wait-UrlReady -Url $apiUrl)) {
    throw 'Backend failed to start on http://127.0.0.1:3000'
  }
}

if (-not (Test-UrlReady -Url $webUrl)) {
  Start-HiddenNodeProcess -WorkingDirectory $webDir -Arguments @('-e', "const http=require('http');const fs=require('fs');const path=require('path');const root=process.cwd();const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};http.createServer((req,res)=>{let filePath=path.join(root,req.url==='/'?'index.html':decodeURIComponent(req.url.split('?')[0]));if(!filePath.startsWith(root)){res.statusCode=403;return res.end('Forbidden')}fs.stat(filePath,(err,stat)=>{if(err){res.statusCode=404;return res.end('Not Found')}if(stat.isDirectory()) filePath=path.join(filePath,'index.html');fs.readFile(filePath,(readErr,data)=>{if(readErr){res.statusCode=404;return res.end('Not Found')}res.setHeader('Content-Type',mime[path.extname(filePath)]||'application/octet-stream');res.end(data)})})}).listen(3001,'127.0.0.1')")
  if (-not (Wait-UrlReady -Url $webUrl)) {
    throw 'Frontend failed to start on http://127.0.0.1:3001'
  }
}

Start-Process $webUrl | Out-Null

$ErrorActionPreference = 'Stop'

$clientDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputsDir = Split-Path -Parent $clientDir
$repoRoot = Split-Path -Parent $outputsDir
$apiDir = Join-Path $repoRoot 'work\KuGouMusicApi'
$staticScript = Join-Path $outputsDir 'start-static-server.js'
$apiUrl = 'http://127.0.0.1:3000/server/now'
$webUrl = 'http://127.0.0.1:3001/kugou-client/index.html'

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
  throw "KuGouMusicApi directory not found: $apiDir"
}

if (-not (Test-Path -LiteralPath $staticScript)) {
  throw "Static server script not found: $staticScript"
}

if (-not (Test-UrlReady -Url $apiUrl)) {
  Start-HiddenNodeProcess -WorkingDirectory $apiDir -Arguments @('app.js')
  if (-not (Wait-UrlReady -Url $apiUrl)) {
    throw 'KuGouMusicApi failed to start on http://127.0.0.1:3000'
  }
}

if (-not (Test-UrlReady -Url $webUrl)) {
  Start-HiddenNodeProcess -WorkingDirectory $outputsDir -Arguments @($staticScript)
  if (-not (Wait-UrlReady -Url $webUrl)) {
    throw 'Static server failed to start on http://127.0.0.1:3001'
  }
}

Start-Process $webUrl | Out-Null

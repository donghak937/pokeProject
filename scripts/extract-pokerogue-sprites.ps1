$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$assetRoot = "C:\tmp\pokerogue-assets\images\pokemon"
$dataPath = "src\data\pokemon.json"
$outRoot = "public\pokemon-sprites"

if (!(Test-Path $assetRoot)) {
  throw "PokeRogue assets not found at $assetRoot"
}

if (Test-Path $outRoot) {
  Remove-Item -LiteralPath $outRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
$pokemon = Get-Content -Raw -Encoding UTF8 $dataPath | ConvertFrom-Json
$made = 0
$missing = 0

foreach ($mon in $pokemon) {
  $dex = [string]$mon.dex
  $jsonPath = Join-Path $assetRoot "$dex.json"
  $pngPath = Join-Path $assetRoot "$dex.png"

  if (!(Test-Path $jsonPath) -or !(Test-Path $pngPath)) {
    $candidate = Get-ChildItem -Path $assetRoot -Filter "$dex-*.json" -ErrorAction SilentlyContinue |
      Sort-Object Name |
      Select-Object -First 1

    if ($candidate) {
      $jsonPath = $candidate.FullName
      $pngPath = [System.IO.Path]::ChangeExtension($candidate.FullName, ".png")
    }
  }

  if (!(Test-Path $jsonPath) -or !(Test-Path $pngPath)) {
    $missing += 1
    continue
  }

  $meta = Get-Content -Raw -Encoding UTF8 $jsonPath | ConvertFrom-Json
  if ($meta.textures) {
    $frames = @(@($meta.textures)[0].frames)
  } else {
    $frames = @($meta.frames)
  }

  $frameMeta = $frames |
    Where-Object { $_.frame -and [int]$_.frame.w -gt 0 -and [int]$_.frame.h -gt 0 } |
    Select-Object -First 1

  if (-not $frameMeta) {
    $missing += 1
    continue
  }

  $frame = $frameMeta.frame
  $src = [System.Drawing.Bitmap]::FromFile($pngPath)
  $rect = New-Object System.Drawing.Rectangle([int]$frame.x, [int]$frame.y, [int]$frame.w, [int]$frame.h)
  $crop = $src.Clone($rect, $src.PixelFormat)
  $canvas = New-Object System.Drawing.Bitmap(128, 128, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $scale = [Math]::Min(108 / [double]$crop.Width, 108 / [double]$crop.Height)
  $drawW = [int][Math]::Round($crop.Width * $scale)
  $drawH = [int][Math]::Round($crop.Height * $scale)
  $x = [int][Math]::Round((128 - $drawW) / 2)
  $y = [int][Math]::Round((128 - $drawH) / 2)
  $graphics.DrawImage($crop, $x, $y, $drawW, $drawH)
  $outPath = Join-Path $outRoot "$dex.png"
  $canvas.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $canvas.Dispose()
  $crop.Dispose()
  $src.Dispose()
  $made += 1
}

Write-Output "created=$made missing=$missing"

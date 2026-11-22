<#
  Generates the app icons from the pixel maps below.
    appmeta/icon_front_8x8.png   8x8 colour icon (front display / app menu)
    appmeta/icon_back_11x11.png  11x11 grey icon (back display)
  Also writes 16x enlarged previews to docs/screenshots/.
  Run:  .\tools\make-icons.ps1
#>
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$meta = Join-Path $root "src\app.wakesurf.timer\appmeta"
$prev = Join-Path $root "docs\screenshots"
New-Item -ItemType Directory -Force $prev | Out-Null

# Curling wave, lit from the top right (as the BUSY icon guidelines ask).
# W = foam, L = light water, M = mid water, D = deep water, . = transparent
$front = @(
    "..WWWW..",
    ".WLLLLW.",
    "W....MLW",
    ".....DML",
    "..L.DMML",
    ".LMDMMMD",
    "LMMMMMDD",
    "DDDDDDDD"
)
$frontColors = @{
    "W" = "#FFFFFF"; "L" = "#7FD8FF"; "M" = "#2E8FE0"; "D" = "#1A4F9C"
}

# Same wave as a single-tone silhouette for the greyscale back display.
$back = @(
    "...XXXXX...",
    ".XXXXXXXXX.",
    "XX......XXX",
    "X.......XXX",
    ".......XXXX",
    "...X..XXXXX",
    "..XXXXXXXXX",
    ".XXXXXXXXXX",
    "XXXXXXXXXXX",
    "...........",
    "XXXXXXXXXXX"
)
$backColors = @{ "X" = "#888888" }

function New-Icon($map, $colors, $path, $previewPath) {
    $h = $map.Count; $w = $map[0].Length
    $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $ch = [string]$map[$y][$x]
            if ($colors.ContainsKey($ch)) {
                $bmp.SetPixel($x, $y, [System.Drawing.ColorTranslator]::FromHtml($colors[$ch]))
            } else {
                $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            }
        }
    }
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

    $s = 16
    $big = New-Object System.Drawing.Bitmap ($w * $s), ($h * $s)
    $g = [System.Drawing.Graphics]::FromImage($big)
    $g.Clear([System.Drawing.Color]::Black)
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $c = $bmp.GetPixel($x, $y)
            if ($c.A -gt 0) {
                $br = New-Object System.Drawing.SolidBrush $c
                $g.FillRectangle($br, $x * $s, $y * $s, $s - 2, $s - 2)
                $br.Dispose()
            }
        }
    }
    $big.Save($previewPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $big.Dispose(); $bmp.Dispose()
    $path
}

New-Icon $front $frontColors (Join-Path $meta "icon_front_8x8.png") (Join-Path $prev "icon-front.png")
New-Icon $back $backColors (Join-Path $meta "icon_back_11x11.png") (Join-Path $prev "icon-back.png")

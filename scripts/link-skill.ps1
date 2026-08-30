param(
    [string]$SkillSource = (Join-Path $PSScriptRoot "..\.agents\skills\ariadne"),
    [string]$WinHome = $env:USERPROFILE
)

$ErrorActionPreference = "Stop"
$SkillSource = (Resolve-Path $SkillSource).Path

if (-not (Test-Path (Join-Path $SkillSource "SKILL.md"))) {
    throw "SKILL.md not found at $SkillSource"
}

$targets = @(
    (Join-Path $WinHome ".agents\skills"),
    (Join-Path $WinHome ".gemini\config\skills")
)

foreach ($dir in $targets) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $link = Join-Path $dir "ariadne"
    if (Test-Path $link) {
        $item = Get-Item $link -Force
        if ($item.LinkType) {
            $existing = [string]$item.Target
            if ($existing -ieq $SkillSource) {
                Write-Host "= $link"
            } else {
                $item.Delete()
                New-Item -ItemType Junction -Path $link -Target $SkillSource | Out-Null
                Write-Host "~ $link -> $SkillSource"
            }
        } else {
            Write-Warning "skipping $link (real directory exists)"
        }
        continue
    }
    New-Item -ItemType Junction -Path $link -Target $SkillSource | Out-Null
    Write-Host "+ $link -> $SkillSource"
}

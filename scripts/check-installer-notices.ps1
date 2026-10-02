param([string]$Package = '', [string]$Notice = '', [string]$Version = '', [string]$Report = '', [string]$ThirdPartyNotice = '', [string]$ThirdPartyInventory = '')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
if (-not $Report) { $Report = Join-Path $workspace 'test-results/installer-notices/summary.json' }
if (Test-Path -LiteralPath $Report) { Remove-Item -LiteralPath $Report }
if (-not $Version) { $Version = (Get-Content -LiteralPath (Join-Path $workspace 'package.json') -Raw | ConvertFrom-Json).version }
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'A reviewed application version is required.' }
if (-not $Package) { $Package = Join-Path $workspace "out/make/squirrel.windows/x64/cc_lime-$Version-full.nupkg" }
if (-not $Notice) { $Notice = Join-Path $workspace 'out/C.C. Lime-win32-x64/LICENSES.chromium.html' }
if (-not $ThirdPartyNotice) { $ThirdPartyNotice = Join-Path $workspace 'out/C.C. Lime-win32-x64/resources/THIRD_PARTY_NOTICES.txt' }
if (-not $ThirdPartyInventory) { $ThirdPartyInventory = Join-Path $workspace 'dist/third-party-inventory.json' }
$thirdSource = Get-Item -LiteralPath $ThirdPartyNotice
if ($thirdSource.PSIsContainer -or $thirdSource.Length -eq 0) { throw 'Third-party dependency notices are missing or empty.' }
$thirdHash = (Get-FileHash -LiteralPath $ThirdPartyNotice).Hash.ToLowerInvariant()
$thirdInventory = Get-Content -LiteralPath $ThirdPartyInventory -Raw | ConvertFrom-Json -Depth 30
if ($thirdInventory.noticeSha256 -cne $thirdHash -or $thirdInventory.packages.Count -lt 1) { throw 'Dependency notice inventory is inconsistent.' }
$sourceNotice = Get-Item -LiteralPath $Notice
if ($sourceNotice.PSIsContainer -or $sourceNotice.Length -eq 0) { throw 'Packaged Chromium notices are missing or empty.' }
$expectedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Notice).Hash.ToLowerInvariant()
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead([System.IO.Path]::GetFullPath($Package))
try {
    $entries = @($zip.Entries | Where-Object { $_.FullName.Replace('\', '/') -ieq 'lib/net45/LICENSES.chromium.html' })
    if ($entries.Count -ne 1) { throw 'Installer must contain exactly one Chromium notice entry.' }
    if ($entries[0].Length -ne $sourceNotice.Length) { throw 'Installer notice size does not match the package.' }
    $stream = $entries[0].Open()
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $actualHash = [System.Convert]::ToHexString($sha.ComputeHash($stream)).ToLowerInvariant() }
    finally { $stream.Dispose(); $sha.Dispose() }
    if ($actualHash -ne $expectedHash) { throw 'Installer notice bytes do not match the package.' }
    $thirdEntries = @($zip.Entries | Where-Object { $_.FullName.Replace('\', '/') -ieq 'lib/net45/resources/THIRD_PARTY_NOTICES.txt' })
    if ($thirdEntries.Count -ne 1 -or $thirdEntries[0].Length -ne $thirdSource.Length) { throw 'Installer dependency notices are missing, ambiguous or changed.' }
    $thirdStream = $thirdEntries[0].Open()
    try { $thirdActual = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($thirdStream)).ToLowerInvariant() } finally { $thirdStream.Dispose() }
    if ($thirdActual -cne $thirdHash) { throw 'Installer dependency notice bytes differ.' }
    $coveredSources = @($thirdInventory.packages | ForEach-Object { $_.sourceFiles })
    foreach ($source in $coveredSources) {
      if ($source.path -notmatch '^ical\.js-2\.2\.1/(lib/[A-Za-z0-9_./-]+\.js|LICENSE|package\.json)$' -or $source.path.Split('/') -contains '..') { throw 'Unreviewed covered-source path.' }
      $entryPath = "lib/net45/resources/third-party-source/$($source.path)"
      $sourceEntries = @($zip.Entries | Where-Object { $_.FullName.Replace('\', '/') -ieq $entryPath })
      if ($sourceEntries.Count -ne 1 -or $sourceEntries[0].Length -ne $source.bytes) { throw 'Installer covered source is missing, ambiguous or changed.' }
      $sourceStream = $sourceEntries[0].Open()
      try { $sourceHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($sourceStream)).ToLowerInvariant() } finally { $sourceStream.Dispose() }
      if ($sourceHash -cne $source.sha256) { throw 'Installer covered-source bytes differ.' }
    }

    $metadata = @($zip.Entries | Where-Object { $_.FullName -match '^[^/\\]+\.nuspec$' })
    if ($metadata.Count -ne 1 -or $metadata[0].Length -gt 1048576) { throw 'Installer metadata is missing, ambiguous or oversized.' }
    $settings = [System.Xml.XmlReaderSettings]::new()
    $settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $settings.MaxCharactersInDocument = 1048576
    $metadataStream = $metadata[0].Open()
    $reader = [System.Xml.XmlReader]::Create($metadataStream, $settings)
    try {
        $document = [System.Xml.XmlDocument]::new()
        $document.XmlResolver = $null
        $document.Load($reader)
        $versions = $document.SelectNodes("/*[local-name()='package']/*[local-name()='metadata']/*[local-name()='version']")
        if ($versions.Count -ne 1 -or $versions[0].InnerText -cne $Version) { throw 'Installer metadata version does not match the application.' }
    } finally { $reader.Dispose(); $metadataStream.Dispose() }
} finally { $zip.Dispose() }
$result = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    version = $Version
    packageSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $Package).Hash.ToLowerInvariant()
    noticeBytes = $sourceNotice.Length
    noticeSha256 = $actualHash
    exactNoticeMatch = $true
    metadataVersionMatch = $true
    thirdPartyNoticeSha256 = $thirdHash
    exactThirdPartyNoticeMatch = $true
    coveredSourceFiles = $coveredSources.Count
    exactCoveredSourceMatch = $true
    scope = 'Read-only nupkg entry verification; no extraction, installation, full license review or production approval.'
}
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($Report))) | Out-Null
$result | ConvertTo-Json | Set-Content -LiteralPath $Report -Encoding utf8
Write-Output "Installer $Version retains the exact $($sourceNotice.Length)-byte Chromium notices and matching package metadata."

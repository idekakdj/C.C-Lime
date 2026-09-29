param([string]$Package = '', [string]$Notice = '', [string]$Version = '', [string]$Report = '')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
if (-not $Report) { $Report = Join-Path $workspace 'test-results/installer-notices/summary.json' }
if (Test-Path -LiteralPath $Report) { Remove-Item -LiteralPath $Report }
if (-not $Version) { $Version = (Get-Content -LiteralPath (Join-Path $workspace 'package.json') -Raw | ConvertFrom-Json).version }
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'A reviewed application version is required.' }
if (-not $Package) { $Package = Join-Path $workspace "out/make/squirrel.windows/x64/cc_lime-$Version-full.nupkg" }
if (-not $Notice) { $Notice = Join-Path $workspace 'out/C.C. Lime-win32-x64/LICENSES.chromium.html' }
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
    scope = 'Read-only nupkg entry verification; no extraction, installation, full license review or production approval.'
}
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($Report))) | Out-Null
$result | ConvertTo-Json | Set-Content -LiteralPath $Report -Encoding utf8
Write-Output "Installer $Version retains the exact $($sourceNotice.Length)-byte Chromium notices and matching package metadata."

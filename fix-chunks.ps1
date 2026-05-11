$chunksDir = Join-Path (Get-Location) ".open-next/server-functions/default/.next/server/chunks/ssr"
$runtimePath = Join-Path $chunksDir "[turbopack]_runtime.js"

$runtime = [System.IO.File]::ReadAllText($runtimePath)
$chunkFiles = Get-ChildItem -File $chunksDir | Where-Object { $_.Name -notmatch "\[turbopack\]" -and $_.Extension -eq ".js" }

$switchCases = @()
foreach ($chunk in $chunkFiles) {
    $chunkPath = "server/chunks/ssr/$($chunk.Name)"
    $content = [System.IO.File]::ReadAllText($chunk.FullName)
    # Strip "module.exports=" prefix and trailing ";"
    $content = $content -replace '^module\.exports=', ''
    $content = $content -replace ';\s*$', ''
    # Remove source map comment
    $content = $content -replace '//# sourceMappingURL.*', ''
    $content = $content.Trim()
    $switchCases += "      case `"$chunkPath`": return $content"
}

$casesStr = $switchCases -join "`n"

$oldFunc = 'function requireChunk(chunkPath) {
    switch(chunkPath) {

      default:
        throw new Error(`"Not found ${chunkPath}`");
    }
  }'

$newFunc = "  function requireChunk(chunkPath) {
    switch(chunkPath) {
$casesStr
      default:
        throw new Error(`"Not found `${chunkPath}`");
    }
  }"

$newRuntime = $runtime -replace [regex]::Escape($oldFunc), $newFunc

[System.IO.File]::WriteAllText($runtimePath, $newRuntime)
Write-Output "Fixed requireChunk with $($chunkFiles.Count) chunks"

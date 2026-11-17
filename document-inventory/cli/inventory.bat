@echo off
setlocal
set "INVENTORY_SCRIPT=%~f0"
set "INVENTORY_ROOT=%~dp0"

echo.
echo ==========================================
echo          INVENTARIO DOCUMENTAL
echo ==========================================
echo.
echo Carpeta que se analizara:
echo %INVENTORY_ROOT%
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$raw=[System.IO.File]::ReadAllText($env:INVENTORY_SCRIPT); $marker='#<POWERSHELL>'; $index=$raw.IndexOf($marker); if($index -lt 0){throw 'No se encontro el bloque PowerShell.'}; $code=$raw.Substring($index+$marker.Length); & ([scriptblock]::Create($code)) $env:INVENTORY_ROOT"
set "RESULT=%ERRORLEVEL%"

echo.
if "%RESULT%"=="0" (
  echo Analisis completado.
) else (
  echo El analisis termino con errores. Codigo: %RESULT%
)
echo.
echo Presione una tecla para cerrar.
pause > nul
exit /b %RESULT%

#<POWERSHELL>
param([string]$Root)

$ErrorActionPreference = "Stop"

function Export-CsvSafe {
    param([object[]]$Rows, [string]$Path, [string[]]$Columns)
    if ($Rows -and $Rows.Count -gt 0) {
        $Rows | Export-Csv -LiteralPath $Path -NoTypeInformation -Encoding UTF8
    } else {
        Set-Content -LiteralPath $Path -Value ($Columns -join ",") -Encoding UTF8
    }
}

try {
    $Root = (Resolve-Path -LiteralPath $Root).Path.TrimEnd("\")
    $Desktop = [Environment]::GetFolderPath("Desktop")
    if ([string]::IsNullOrWhiteSpace($Desktop)) { $Desktop = $env:USERPROFILE }
    $Output = Join-Path $Desktop "Inventario_documental"
    New-Item -ItemType Directory -Force -Path $Output | Out-Null

    Write-Host "Analizando metadatos. No se abriran documentos."
    $ScanErrors = @()
    $OutputPrefix = $Output.TrimEnd("\") + "\"
    $Items = @(
        Get-ChildItem -LiteralPath $Root -Force -Recurse -ErrorAction SilentlyContinue -ErrorVariable +ScanErrors |
        Where-Object {
            $_.FullName -ne $Output -and
            -not $_.FullName.StartsWith($OutputPrefix, [System.StringComparison]::OrdinalIgnoreCase)
        }
    )
    $Files = @($Items | Where-Object { -not $_.PSIsContainer })
    $Folders = @($Items | Where-Object { $_.PSIsContainer })

    $FileRows = @(
        foreach ($File in $Files) {
            $Relative = $File.FullName.Substring($Root.Length).TrimStart("\")
            $Extension = if ($File.Extension) { $File.Extension.ToLowerInvariant() } else { "(sin extension)" }
            [pscustomobject]@{
                rutaRelativa = $Relative
                nombre = $File.Name
                extension = $Extension
                tamanoBytes = $File.Length
                tamanoMB = [math]::Round($File.Length / 1MB, 3)
                fechaCreacion = $File.CreationTime.ToString("yyyy-MM-ddTHH:mm:ss")
                ultimaModificacion = $File.LastWriteTime.ToString("yyyy-MM-ddTHH:mm:ss")
                anioModificacion = $File.LastWriteTime.Year
            }
        }
    )

    $FolderStats = @{}
    $RootKey = $Root.ToLowerInvariant()
    $FolderStats[$RootKey] = [pscustomobject]@{ FullPath = $Root; DirectFiles = 0; RecursiveFiles = 0; TotalBytes = [int64]0 }
    foreach ($Folder in $Folders) {
        $FolderStats[$Folder.FullName.ToLowerInvariant()] = [pscustomobject]@{
            FullPath = $Folder.FullName; DirectFiles = 0; RecursiveFiles = 0; TotalBytes = [int64]0
        }
    }

    foreach ($File in $Files) {
        $Current = $File.DirectoryName
        $DirectKey = $Current.ToLowerInvariant()
        if ($FolderStats.ContainsKey($DirectKey)) { $FolderStats[$DirectKey].DirectFiles++ }
        while ($Current -and $Current.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
            $Key = $Current.ToLowerInvariant()
            if (-not $FolderStats.ContainsKey($Key)) {
                $FolderStats[$Key] = [pscustomobject]@{
                    FullPath = $Current; DirectFiles = 0; RecursiveFiles = 0; TotalBytes = [int64]0
                }
            }
            $FolderStats[$Key].RecursiveFiles++
            $FolderStats[$Key].TotalBytes += [int64]$File.Length
            if ($Key -eq $RootKey) { break }
            $Current = Split-Path -LiteralPath $Current -Parent
        }
    }

    $FolderRows = @(
        foreach ($Stat in $FolderStats.Values) {
            $Relative = if ($Stat.FullPath -eq $Root) { "." } else { $Stat.FullPath.Substring($Root.Length).TrimStart("\") }
            $Name = if ($Relative -eq ".") { Split-Path -LiteralPath $Root -Leaf } else { Split-Path -LiteralPath $Stat.FullPath -Leaf }
            $Level = if ($Relative -eq ".") { 0 } else { ($Relative -split "\\").Count }
            [pscustomobject]@{
                rutaRelativa = $Relative; nombre = $Name; nivel = $Level
                archivosDirectos = $Stat.DirectFiles; archivosRecursivos = $Stat.RecursiveFiles
                tamanoTotalBytes = $Stat.TotalBytes
            }
        }
    )

    $ExtensionRows = @(
        $FileRows | Group-Object extension |
        ForEach-Object { [pscustomobject]@{ extension = $_.Name; cantidad = $_.Count } } |
        Sort-Object @{ Expression = "cantidad"; Descending = $true }, extension
    )
    $YearRows = @(
        $FileRows | Group-Object anioModificacion |
        ForEach-Object { [pscustomobject]@{ anio = $_.Name; cantidad = $_.Count } } |
        Sort-Object @{ Expression = "anio"; Descending = $true }
    )

    Export-CsvSafe $FileRows (Join-Path $Output "archivos.csv") @(
        "rutaRelativa", "nombre", "extension", "tamanoBytes", "tamanoMB", "fechaCreacion", "ultimaModificacion", "anioModificacion"
    )
    Export-CsvSafe $FolderRows (Join-Path $Output "carpetas.csv") @(
        "rutaRelativa", "nombre", "nivel", "archivosDirectos", "archivosRecursivos", "tamanoTotalBytes"
    )
    Export-CsvSafe $ExtensionRows (Join-Path $Output "extensiones.csv") @("extension", "cantidad")
    Export-CsvSafe $YearRows (Join-Path $Output "modificaciones_por_anio.csv") @("anio", "cantidad")

    $TotalBytes = [int64](($Files | Measure-Object -Property Length -Sum).Sum)
    @(
        "INVENTARIO DOCUMENTAL"
        "Fecha de analisis: $((Get-Date).ToString('yyyy-MM-ddTHH:mm:ss'))"
        "Carpeta analizada: $Root"
        "Archivos: $($Files.Count)"
        "Carpetas: $($Folders.Count)"
        "Tamano total (bytes): $TotalBytes"
        "Tamano total (MB): $([math]::Round($TotalBytes / 1MB, 2))"
        "Errores de lectura: $($ScanErrors.Count)"
        ""
        "El analisis consulto metadatos. No abrio ni transmitio documentos."
    ) | Out-File -LiteralPath (Join-Path $Output "resumen.txt") -Encoding UTF8

    if ($ScanErrors.Count -gt 0) {
        $ScanErrors | ForEach-Object { $_.ToString() } |
            Out-File -LiteralPath (Join-Path $Output "errores.txt") -Encoding UTF8
    } else {
        $ErrorFile = Join-Path $Output "errores.txt"
        if (Test-Path -LiteralPath $ErrorFile) { Remove-Item -LiteralPath $ErrorFile -Force }
    }

    Write-Host ""
    Write-Host "Archivos: $($Files.Count)"
    Write-Host "Carpetas: $($Folders.Count)"
    Write-Host "Errores de lectura: $($ScanErrors.Count)"
    Write-Host "Resultados: $Output"
    exit 0
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
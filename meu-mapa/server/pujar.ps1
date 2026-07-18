# pujar.ps1 — Puja les dades al volum de Fly.io
$local = "..\public\web_data\*.json"
$remot = "/public/web_data/"

Write-Host "Pujant dades al servidor..."
flyctl ssh console -C "mkdir -p $remot"

Get-ChildItem $local | ForEach-Object {
    Write-Host "  $($_.Name)..."
    flyctl ssh sftp copy $_.FullName "$remot$($_.Name)"
}

Write-Host "OK! Dades actualitzades."

# Stop and restart Apollo dev servers (backend :8000, frontend :3000).

$ErrorActionPreference = "SilentlyContinue"

# --- Stop any running Apollo processes ---
Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match 'run\.py|next dev'
} | ForEach-Object {
    taskkill /F /T /PID $_.ProcessId
}

Start-Sleep -Seconds 3

# --- Start backend ---
Start-Process -FilePath "C:\Users\hamid\Downloads\Apollo\backend\.venv\Scripts\python.exe" `
    -ArgumentList "run.py" `
    -WorkingDirectory "C:\Users\hamid\Downloads\Apollo\backend" `
    -WindowStyle Hidden

# --- Start frontend ---
Start-Process -FilePath "npm.cmd" `
    -ArgumentList "run","dev" `
    -WorkingDirectory "C:\Users\hamid\Downloads\Apollo\frontend" `
    -WindowStyle Hidden

# --- Wait and verify ---
Start-Sleep -Seconds 10
try {
    $health = Invoke-RestMethod http://localhost:8000/health -TimeoutSec 10
    Write-Host "Backend :8000 OK (cache: $($health.cache))"
} catch {
    Write-Host "Backend :8000 not responding yet - waiting more..."
    Start-Sleep -Seconds 8
    try {
        $health = Invoke-RestMethod http://localhost:8000/health -TimeoutSec 10
        Write-Host "Backend :8000 OK (cache: $($health.cache))"
    } catch {
        Write-Host "Backend failed to start."
    }
}

$frontendReady = $false
for ($attempt = 1; $attempt -le 6; $attempt++) {
    try {
        $front = Invoke-WebRequest http://localhost:3000 -UseBasicParsing -TimeoutSec 10
        Write-Host "Frontend :3000 OK (status $($front.StatusCode))"
        $frontendReady = $true
        break
    } catch {
        if ($attempt -lt 6) {
            Write-Host "Frontend :3000 is still starting (attempt $attempt/6)..."
            Start-Sleep -Seconds 10
        }
    }
}
if (-not $frontendReady) {
    Write-Host "Frontend :3000 did not respond after 60 seconds. Check frontend/frontend-dev-error.log."
}

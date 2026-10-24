$ErrorActionPreference = "Stop"
if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 "$PSScriptRoot/dev.py" @args
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    & python "$PSScriptRoot/dev.py" @args
} else {
    Write-Error "Instale Python 3.11 ou superior."
    exit 1
}
exit $LASTEXITCODE

$ErrorActionPreference = "Stop"

try {
    Write-Host "Fetching latest changes from origin..."
    git fetch origin main 2>$null | Out-Null
}
catch {
    Write-Host "Warning: Could not fetch from origin. Proceeding with local refs."
}

$baseBranch = "origin/main"
git rev-parse --verify $baseBranch 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "origin/main not found, defaulting to main"
    $baseBranch = "main"
}

# Find the common ancestor (merge base) to ensure we're reviewing 
# all work done on this branch (committed + uncommitted) relative to where it started from main.
try {
    $mergeBase = git merge-base $baseBranch HEAD
    if (-not $mergeBase) {
        throw "Could not determine merge base."
    }
    
    Write-Host "Generating diff against $baseBranch (Base: $mergeBase)..."
    git diff $mergeBase
}
catch {
    Write-Error "Failed to generate diff: $_"
    exit 1
}

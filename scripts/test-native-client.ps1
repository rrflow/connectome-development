param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [Parameter(Mandatory = $true)][string]$FixtureRoot
)

$ErrorActionPreference = 'Stop'
$enginePath = (Resolve-Path -LiteralPath $Executable).Path
$fixturePath = [System.IO.Path]::GetFullPath($FixtureRoot)
$runPath = Join-Path $fixturePath ([System.Guid]::NewGuid().ToString('N'))
$projectPath = Join-Path $runPath 'project'
New-Item -ItemType Directory -Path $projectPath -Force | Out-Null
$planPath = Join-Path $runPath 'install-plan.json'
$planText = & $enginePath install plan --project $projectPath --mode fresh
if ($LASTEXITCODE -ne 0) { throw 'RRFlow installation planning failed' }
$planText | Set-Content -LiteralPath $planPath -Encoding utf8NoBOM
$plan = $planText | ConvertFrom-Json
$digest = $plan.installation.plan_sha256
if (-not $digest) { throw 'RRFlow did not return an installation plan digest' }
& $enginePath install apply --project $projectPath --mode fresh --plan $planPath --expect $digest | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'RRFlow installation apply failed' }

$stdoutPath = Join-Path $runPath 'serve.stdout.log'
$stderrPath = Join-Path $runPath 'serve.stderr.log'
$serveArgs = @('--json', 'serve', '--bind', '127.0.0.1:0', '--project', ('"' + $projectPath + '"'))
$server = Start-Process -FilePath $enginePath -ArgumentList $serveArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
try {
    $deadline = [DateTime]::UtcNow.AddSeconds(180)
    $announcement = $null
    while ([DateTime]::UtcNow -lt $deadline) {
        if ($server.HasExited) { throw "RRFlow exited before announcing its address; see $stderrPath" }
        $line = Get-Content -LiteralPath $stdoutPath -TotalCount 1 -ErrorAction SilentlyContinue
        if ($line) { $announcement = $line | ConvertFrom-Json; break }
        Start-Sleep -Milliseconds 100
    }
    if (-not $announcement.url -or -not $announcement.instance_id) { throw 'RRFlow did not announce an endpoint and instance' }
    $address = ([Uri]$announcement.url).Authority
    & $enginePath ready --address $address --project $projectPath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Installed RRFlow authenticated readiness failed' }
    $env:RRFLOW_CONNECTOME_TEST_ENDPOINT = $announcement.url
    $env:RRFLOW_CONNECTOME_TEST_INSTANCE = $announcement.instance_id
    $env:RRFLOW_CONNECTOME_TEST_CREDENTIAL = Join-Path $projectPath '.rrflow/credentials/local-operator.json'
    $env:RUSTC_WRAPPER = ''
    $env:CARGO_PROFILE_DEV_DEBUG = '0'
    $env:CARGO_BUILD_JOBS = '4'
    $env:CARGO_INCREMENTAL = '0'
    $env:RUST_MIN_STACK = '16777216'
    & cargo test --manifest-path (Join-Path $PSScriptRoot '../src-tauri/Cargo.toml') --locked installed_rrflow_session_query_and_denial -- --ignored --nocapture
    if ($LASTEXITCODE -ne 0) { throw 'Native client process verification failed' }
    Write-Output "Native client fixture passed; retained process evidence at $runPath"
} finally {
    if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force; $server.WaitForExit() }
    Remove-Item Env:RRFLOW_CONNECTOME_TEST_ENDPOINT -ErrorAction SilentlyContinue
    Remove-Item Env:RRFLOW_CONNECTOME_TEST_INSTANCE -ErrorAction SilentlyContinue
    Remove-Item Env:RRFLOW_CONNECTOME_TEST_CREDENTIAL -ErrorAction SilentlyContinue
}

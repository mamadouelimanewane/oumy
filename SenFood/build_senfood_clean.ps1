# Simplified SenFood APK Builder
$ErrorActionPreference = "Continue"

$JavaHome = "C:\Program Files\Java\jdk-24"
$AndroidHome = "C:\Android\Sdk"

$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidHome
$env:PATH = "$JavaHome\bin;$AndroidHome\platform-tools;$AndroidHome\cmdline-tools\latest\bin;$env:PATH"

$ReleaseDir = "$PSScriptRoot\releases"
if (-not (Test-Path $ReleaseDir)) { New-Item -ItemType Directory -Force -Path $ReleaseDir }

function Build-App {
    param($folder, $name)
    Write-Host "--- Building $name ---"
    try {
        Set-Location "$PSScriptRoot\$folder"
        npm run build
        npx cap sync android
        
        $localProps = "$PSScriptRoot\$folder\android\local.properties"
        "sdk.dir=$($AndroidHome.Replace('\', '/'))" | Out-File -FilePath $localProps -Encoding ASCII
        
        Set-Location "$PSScriptRoot\$folder\android"
        cmd /c "gradlew.bat assembleDebug"
        
        if (Test-Path "app\build\outputs\apk\debug\app-debug.apk") {
            Copy-Item "app\build\outputs\apk\debug\app-debug.apk" "$ReleaseDir\SenFood-$name.apk" -Force
            Write-Host "SUCCESS: $name APK created."
        } else {
            Write-Host "ERROR: $name APK not found."
        }
    } catch {
        Write-Host "ERROR building $name : $_"
    }
    Set-Location $PSScriptRoot
}

Build-App "client-pwa" "Client"
Build-App "panel-admin" "Admin"

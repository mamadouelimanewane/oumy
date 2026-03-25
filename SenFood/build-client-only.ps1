# Script PowerShell pour build l'APK Client uniquement
# Nécessite: Java JDK 17+, Android SDK, Node.js 20+

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🏗️  SenFood Client APK Builder" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$ReleaseDir = "$PSScriptRoot\releases"

# Détecter Java automatiquement
$JavaHome = $env:JAVA_HOME
if (-not $JavaHome) {
    $JavaHome = "C:\Program Files\Java\jdk-17"
    if (-not (Test-Path $JavaHome)) {
        $JavaHome = "C:\Program Files\Java\jdk-21"
    }
    if (-not (Test-Path $JavaHome)) {
        $JavaHome = "C:\Program Files\Java\jdk-24"
    }
}

# Détecter Android SDK
$AndroidHome = $env:ANDROID_HOME
if (-not $AndroidHome) {
    $AndroidHome = "$env:LOCALAPPDATA\Android\Sdk"
    if (-not (Test-Path $AndroidHome)) {
        $AndroidHome = "$env:USERPROFILE\AppData\Local\Android\Sdk"
    }
}

# Vérifications
Write-Host "🔍 Vérification des prérequis..." -ForegroundColor Yellow

# Vérifier Java
if (-not (Test-Path $JavaHome)) {
    Write-Host "❌ Java JDK non trouvé" -ForegroundColor Red
    Write-Host "   Installez Java 17+ depuis: https://adoptium.net/" -ForegroundColor Gray
    exit 1
}
Write-Host "  ✅ Java trouvé: $JavaHome" -ForegroundColor Green

# Vérifier Android SDK
if (-not (Test-Path $AndroidHome)) {
    Write-Host "❌ Android SDK non trouvé" -ForegroundColor Red
    Write-Host "   Installez Android Studio: https://developer.android.com/studio" -ForegroundColor Gray
    exit 1
}
Write-Host "  ✅ Android SDK trouvé: $AndroidHome" -ForegroundColor Green

# Configurer environnement
$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidHome
$env:PATH = "$JavaHome\bin;$AndroidHome\platform-tools;$AndroidHome\cmdline-tools\latest\bin;$env:PATH"

# Créer dossier releases
if (-not (Test-Path $ReleaseDir)) {
    New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
}

# =====================
# BUILD CLIENT PWA
# =====================
Write-Host ""
Write-Host "📱 Building Client PWA APK..." -ForegroundColor Yellow
Write-Host "------------------------------------------" -ForegroundColor Gray

try {
    Set-Location "$PSScriptRoot\client-pwa"
    
    Write-Host "  → Installing dependencies..." -ForegroundColor Gray
    npm ci 2>&1 | Out-Null
    
    Write-Host "  → Building web app..." -ForegroundColor Gray
    npm run build 2>&1 | Out-Null
    
    Write-Host "  → Cleaning Android folder..." -ForegroundColor Gray
    if (Test-Path "android") {
        Remove-Item -Recurse -Force "android" -ErrorAction SilentlyContinue
        Write-Host "    ✓ Android folder removed" -ForegroundColor Green
    }
    
    Write-Host "  → Adding Android platform..." -ForegroundColor Gray
    npx cap add android 2>&1 | Out-Null
    Write-Host "    ✓ Android platform added" -ForegroundColor Green
    
    Write-Host "  → Syncing with Capacitor..." -ForegroundColor Gray
    npx cap sync android 2>&1 | Out-Null
    
    # Créer local.properties
    $localProps = "$PSScriptRoot\client-pwa\android\local.properties"
    "sdk.dir=$AndroidHome".Replace('\', '\\') | Out-File -FilePath $localProps -Encoding UTF8
    Write-Host "    ✓ local.properties created" -ForegroundColor Green
    
    Set-Location "$PSScriptRoot\client-pwa\android"
    
    Write-Host "  → Building APK (peut prendre 5-10 minutes)..." -ForegroundColor Gray
    Write-Host "    ⏳ Compilation en cours..." -ForegroundColor Gray
    
    # Build avec plus de détails en cas d'erreur
    $buildOutput = .\gradlew.bat assembleDebug 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    ❌ Build failed!" -ForegroundColor Red
        Write-Host "    Erreur: $buildOutput" -ForegroundColor Red
        exit 1
    }
    
    if (Test-Path "app\build\outputs\apk\debug\app-debug.apk") {
        Copy-Item "app\build\outputs\apk\debug\app-debug.apk" "$ReleaseDir\SenFood-Client.apk" -Force
        $size = (Get-Item "$ReleaseDir\SenFood-Client.apk").Length / 1MB
        Write-Host ""
        Write-Host "  ✅ Client APK créé avec succès!" -ForegroundColor Green
        Write-Host "     Taille: $([math]::Round($size, 2)) MB" -ForegroundColor Green
        Write-Host "     Emplacement: $ReleaseDir\SenFood-Client.apk" -ForegroundColor Green
    } else {
        Write-Host "  ❌ APK non trouvé après build" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
    exit 1
}

Set-Location $PSScriptRoot

# =====================
# RÉSUMÉ
# =====================
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✨ Build Terminé!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$apk = Get-Item "$ReleaseDir\SenFood-Client.apk" -ErrorAction SilentlyContinue
if ($apk) {
    $size = [math]::Round($apk.Length / 1MB, 2)
    Write-Host "📦 APK généré:" -ForegroundColor Green
    Write-Host "   📱 SenFood-Client.apk - ${size} MB" -ForegroundColor White
    Write-Host ""
    Write-Host "📂 Emplacement: $ReleaseDir" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 Pour installer sur Android:" -ForegroundColor Cyan
    Write-Host "   1. Copiez l'APK sur votre téléphone" -ForegroundColor Gray
    Write-Host "   2. Activez 'Sources inconnues' dans Paramètres > Sécurité" -ForegroundColor Gray
    Write-Host "   3. Ouvrez l'APK et installez" -ForegroundColor Gray
} else {
    Write-Host "❌ Aucun APK généré." -ForegroundColor Red
}

Write-Host ""
Write-Host "Appuyez sur une touche pour fermer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

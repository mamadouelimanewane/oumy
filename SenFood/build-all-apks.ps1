# Script PowerShell complet pour build les APKs SenFood
# Nécessite: Java JDK 17+, Android SDK, Node.js 20+

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🏗️  SenFood APK Builder" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$ReleaseDir = "$PSScriptRoot\releases"
$JavaHome = "C:\Program Files\Java\jdk-24"
$AndroidHome = "$env:LOCALAPPDATA\Android\Sdk"

# Vérifications
Write-Host "🔍 Vérification des prérequis..." -ForegroundColor Yellow

# Vérifier Java
if (-not (Test-Path $JavaHome)) {
    Write-Host "❌ Java JDK non trouvé à: $JavaHome" -ForegroundColor Red
    Write-Host "   Téléchargez-le depuis: https://adoptium.net/" -ForegroundColor Gray
    exit 1
}
Write-Host "  ✅ Java trouvé: $JavaHome" -ForegroundColor Green

# Vérifier Android SDK
if (-not (Test-Path $AndroidHome)) {
    $AndroidHome = "$env:USERPROFILE\AppData\Local\Android\Sdk"
    if (-not (Test-Path $AndroidHome)) {
        Write-Host "❌ Android SDK non trouvé" -ForegroundColor Red
        Write-Host "   Installez Android Studio: https://developer.android.com/studio" -ForegroundColor Gray
        Write-Host "   Ou configurez ANDROID_HOME manuellement" -ForegroundColor Gray
        exit 1
    }
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
    npm ci | Out-Null
    
    Write-Host "  → Building web app..." -ForegroundColor Gray
    npm run build | Out-Null
    
    Write-Host "  → Syncing with Capacitor..." -ForegroundColor Gray
    npx cap sync android | Out-Null
    
    # Créer local.properties si nécessaire
    $localProps = "$PSScriptRoot\client-pwa\android\local.properties"
    if (-not (Test-Path $localProps)) {
        "sdk.dir=$AndroidHome" | Out-File -FilePath $localProps -Encoding UTF8
    }
    
    Set-Location "$PSScriptRoot\client-pwa\android"
    
    Write-Host "  → Building APK (peut prendre plusieurs minutes)..." -ForegroundColor Gray
    .\gradlew.bat assembleDebug --quiet 2>&1 | Out-Null
    
    if (Test-Path "app\build\outputs\apk\debug\app-debug.apk") {
        Copy-Item "app\build\outputs\apk\debug\app-debug.apk" "$ReleaseDir\SenFood-Client.apk" -Force
        $size = (Get-Item "$ReleaseDir\SenFood-Client.apk").Length / 1MB
        Write-Host "  ✅ Client APK créé! ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ APK non trouvé après build" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
}

Set-Location $PSScriptRoot

# =====================
# BUILD ADMIN PANEL
# =====================
Write-Host ""
Write-Host "🎛️  Building Admin Panel APK..." -ForegroundColor Yellow
Write-Host "------------------------------------------" -ForegroundColor Gray

try {
    Set-Location "$PSScriptRoot\panel-admin"
    
    Write-Host "  → Installing dependencies..." -ForegroundColor Gray
    npm ci | Out-Null
    
    Write-Host "  → Building web app..." -ForegroundColor Gray
    npm run build | Out-Null
    
    Write-Host "  → Syncing with Capacitor..." -ForegroundColor Gray
    npx cap sync android | Out-Null
    
    # Créer local.properties si nécessaire
    $localProps = "$PSScriptRoot\panel-admin\android\local.properties"
    if (-not (Test-Path $localProps)) {
        "sdk.dir=$AndroidHome" | Out-File -FilePath $localProps -Encoding UTF8
    }
    
    Set-Location "$PSScriptRoot\panel-admin\android"
    
    Write-Host "  → Building APK (peut prendre plusieurs minutes)..." -ForegroundColor Gray
    .\gradlew.bat assembleDebug --quiet 2>&1 | Out-Null
    
    if (Test-Path "app\build\outputs\apk\debug\app-debug.apk") {
        Copy-Item "app\build\outputs\apk\debug\app-debug.apk" "$ReleaseDir\SenFood-Admin.apk" -Force
        $size = (Get-Item "$ReleaseDir\SenFood-Admin.apk").Length / 1MB
        Write-Host "  ✅ Admin APK créé! ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ APK non trouvé après build" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
}

Set-Location $PSScriptRoot

# =====================
# BUILD LIVREUR APP
# =====================
Write-Host ""
Write-Host "🚚 Building Livreur APK..." -ForegroundColor Yellow
Write-Host "------------------------------------------" -ForegroundColor Gray

try {
    Set-Location "$PSScriptRoot\app-livreur"
    
    Write-Host "  → Installing dependencies..." -ForegroundColor Gray
    npm ci | Out-Null
    
    # Vérifier si EAS CLI est installé
    $easInstalled = Get-Command eas -ErrorAction SilentlyContinue
    
    if ($easInstalled) {
        Write-Host "  → Building avec EAS (Expo)..." -ForegroundColor Gray
        eas build --platform android --profile preview --local --output ./senfood-livreur.apk --non-interactive 2>&1 | Out-Null
        
        if (Test-Path "senfood-livreur.apk") {
            Copy-Item "senfood-livreur.apk" "$ReleaseDir\SenFood-Livreur.apk" -Force
            $size = (Get-Item "$ReleaseDir\SenFood-Livreur.apk").Length / 1MB
            Write-Host "  ✅ Livreur APK créé avec EAS! ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
        }
    } else {
        Write-Host "  → EAS non trouvé, utilisation de prebuild..." -ForegroundColor Gray
        npx expo prebuild --platform android --clean 2>&1 | Out-Null
        
        # Créer local.properties si nécessaire
        $localProps = "$PSScriptRoot\app-livreur\android\local.properties"
        if (-not (Test-Path $localProps)) {
            "sdk.dir=$AndroidHome" | Out-File -FilePath $localProps -Encoding UTF8
        }
        
        Set-Location "$PSScriptRoot\app-livreur\android"
        
        Write-Host "  → Building APK..." -ForegroundColor Gray
        .\gradlew.bat assembleDebug --quiet 2>&1 | Out-Null
        
        if (Test-Path "app\build\outputs\apk\debug\app-debug.apk") {
            Copy-Item "app\build\outputs\apk\debug\app-debug.apk" "$ReleaseDir\SenFood-Livreur.apk" -Force
            $size = (Get-Item "$ReleaseDir\SenFood-Livreur.apk").Length / 1MB
            Write-Host "  ✅ Livreur APK créé! ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
        } else {
            Write-Host "  ❌ APK non trouvé après build" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "  ❌ Erreur: $_" -ForegroundColor Red
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

$apks = Get-ChildItem "$ReleaseDir\*.apk" -ErrorAction SilentlyContinue
if ($apks) {
    Write-Host "📦 APKs générés:" -ForegroundColor Green
    foreach ($apk in $apks) {
        $size = [math]::Round($apk.Length / 1MB, 2)
        Write-Host "   • $($apk.Name) - ${size} MB" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "📂 Dossier: $ReleaseDir" -ForegroundColor Yellow
} else {
    Write-Host "❌ Aucun APK généré. Vérifiez les erreurs ci-dessus." -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Conseil: Installez Android Studio pour obtenir le SDK Android" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Appuyez sur une touche pour continuer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Script PowerShell pour build les APKs SenFood
# Usage: .\build-apks.ps1

$ErrorActionPreference = "Stop"

Write-Host "🏗️  SenFood APK Builder" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan

# Créer le dossier de sortie
$outputDir = "./releases"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

# =====================
# BUILD CLIENT PWA
# =====================
Write-Host "`n📱 Building Client PWA APK..." -ForegroundColor Yellow
Set-Location ./client-pwa

try {
    Write-Host "  → Installing dependencies..." -ForegroundColor Gray
    npm ci

    Write-Host "  → Building web app..." -ForegroundColor Gray
    npm run build

    Write-Host "  → Syncing with Capacitor..." -ForegroundColor Gray
    npx cap sync android

    Write-Host "  → Building APK..." -ForegroundColor Gray
    Set-Location ./android
    .\gradlew assembleDebug --quiet

    Copy-Item ./app/build/outputs/apk/debug/app-debug.apk ../../releases/SenFood-Client.apk -Force
    Write-Host "  ✅ Client APK built successfully!" -ForegroundColor Green

    Set-Location ../..
} catch {
    Write-Host "  ❌ Client build failed: $_" -ForegroundColor Red
    Set-Location ../..
    exit 1
}

# =====================
# BUILD ADMIN PANEL
# =====================
Write-Host "`n🎛️  Building Admin Panel APK..." -ForegroundColor Yellow
Set-Location ./panel-admin

try {
    Write-Host "  → Installing dependencies..." -ForegroundColor Gray
    npm ci

    Write-Host "  → Building web app..." -ForegroundColor Gray
    npm run build

    Write-Host "  → Syncing with Capacitor..." -ForegroundColor Gray
    npx cap sync android

    Write-Host "  → Building APK..." -ForegroundColor Gray
    Set-Location ./android
    .\gradlew assembleDebug --quiet

    Copy-Item ./app/build/outputs/apk/debug/app-debug.apk ../../releases/SenFood-Admin.apk -Force
    Write-Host "  ✅ Admin APK built successfully!" -ForegroundColor Green

    Set-Location ../..
} catch {
    Write-Host "  ❌ Admin build failed: $_" -ForegroundColor Red
    Set-Location ../..
    exit 1
}

# =====================
# BUILD LIVREUR APP (Expo)
# =====================
Write-Host "`n🚚 Building Livreur APK (Expo)..." -ForegroundColor Yellow
Set-Location ./app-livreur

try {
    Write-Host "  → Installing dependencies..." -ForegroundColor Gray
    npm ci

    Write-Host "  → Building with EAS..." -ForegroundColor Gray
    # Note: Requires EAS CLI and Expo account
    # eas build --platform android --profile preview --local --output ./senfood-livreur.apk
    
    # Alternative: Build APK locally with expo prebuild
    npx expo prebuild --platform android
    
    Set-Location ./android
    .\gradlew assembleDebug --quiet

    Copy-Item ./app/build/outputs/apk/debug/app-debug.apk ../../releases/SenFood-Livreur.apk -Force
    Write-Host "  ✅ Livreur APK built successfully!" -ForegroundColor Green

    Set-Location ../..
} catch {
    Write-Host "  ❌ Livreur build failed: $_" -ForegroundColor Red
    Set-Location ../..
    # Don't exit - livreur build is optional with Expo
}

# =====================
# SUMMARY
# =====================
Write-Host "`n✨ Build Complete!" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan

$apks = Get-ChildItem ./releases/*.apk
foreach ($apk in $apks) {
    $size = [math]::Round($apk.Length / 1MB, 2)
    Write-Host "📦 $($apk.Name) - ${size} MB" -ForegroundColor White
}

Write-Host "`nAPKs are ready in ./releases/ folder" -ForegroundColor Green

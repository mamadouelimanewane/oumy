#!/bin/bash
# Script pour build les APKs avec Docker
# Usage: ./build-apks-docker.sh

set -e

echo "=========================================="
echo "🏗️  SenFood APK Builder (Docker)"
echo "=========================================="
echo ""

# Créer le dossier de sortie
mkdir -p releases

# Image Docker avec Android SDK et Node.js
DOCKER_IMAGE="mingc/android-build-box:latest"

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    echo "   Installez Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Docker trouvé"
echo ""

# =====================
# BUILD CLIENT PWA
# =====================
echo "📱 Building Client PWA APK..."
echo "------------------------------------------"

docker run --rm \
    -v "$(pwd)/client-pwa:/project" \
    -v "$(pwd)/releases:/releases" \
    -w /project \
    $DOCKER_IMAGE \
    bash -c "
        npm ci && \
        npm run build && \
        rm -rf android && \
        npx cap add android && \
        npx cap sync android && \
        cd android && \
        ./gradlew assembleDebug && \
        cp app/build/outputs/apk/debug/app-debug.apk /releases/SenFood-Client.apk
    " || echo "❌ Client build failed"

echo ""

# =====================
# BUILD ADMIN PANEL
# =====================
echo "🎛️  Building Admin Panel APK..."
echo "------------------------------------------"

docker run --rm \
    -v "$(pwd)/panel-admin:/project" \
    -v "$(pwd)/releases:/releases" \
    -w /project \
    $DOCKER_IMAGE \
    bash -c "
        npm ci && \
        npm run build && \
        rm -rf android && \
        npx cap add android && \
        npx cap sync android && \
        cd android && \
        ./gradlew assembleDebug && \
        cp app/build/outputs/apk/debug/app-debug.apk /releases/SenFood-Admin.apk
    " || echo "❌ Admin build failed"

echo ""

# =====================
# BUILD LIVREUR APP
# =====================
echo "🚚 Building Livreur APK..."
echo "------------------------------------------"

docker run --rm \
    -v "$(pwd)/app-livreur:/project" \
    -v "$(pwd)/releases:/releases" \
    -w /project \
    $DOCKER_IMAGE \
    bash -c "
        npm ci && \
        rm -rf android && \
        npx expo prebuild --platform android --clean && \
        cd android && \
        ./gradlew assembleDebug && \
        cp app/build/outputs/apk/debug/app-debug.apk /releases/SenFood-Livreur.apk
    " || echo "❌ Livreur build failed"

echo ""

# =====================
# RÉSUMÉ
# =====================
echo "=========================================="
echo "✨ Build Terminé!"
echo "=========================================="
echo ""

if [ -d "releases" ] && [ "$(ls -A releases/*.apk 2>/dev/null)" ]; then
    echo "📦 APKs générés:"
    for apk in releases/*.apk; do
        size=$(du -h "$apk" | cut -f1)
        echo "   • $(basename "$apk") - $size"
    done
    echo ""
    echo "📂 Dossier: ./releases/"
else
    echo "❌ Aucun APK généré"
fi

# Instructions de Build des APKs NOOR EAT

## Prérequis

Avant de pouvoir build les APKs localement, vous devez installer :

### 1. Java JDK 17 ou 24
Télécharger depuis : https://adoptium.net/

### 2. Android SDK
Télécharger Android Studio : https://developer.android.com/studio

Configurer les variables d'environnement :
```powershell
# PowerShell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-24"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
```

Ou de manière permanente via les Variables d'environnement Windows.

### 3. Node.js 20+
https://nodejs.org/

## Build Manuel

### Client PWA
```powershell
cd client-pwa
npm install
npm run build
npx cap sync android
cd android
$env:JAVA_HOME = "C:\Program Files\Java\jdk-24"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat assembleDebug
# APK généré: app/build/outputs/apk/debug/app-debug.apk
```

### Panel Admin
```powershell
cd panel-admin
npm install
npm run build
npx cap sync android
cd android
$env:JAVA_HOME = "C:\Program Files\Java\jdk-24"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat assembleDebug
# APK généré: app/build/outputs/apk/debug/app-debug.apk
```

### Livreur App (Expo)
```powershell
cd app-livreur
npm install
# Avec EAS (nécessite un compte Expo)
eas build --platform android --profile preview --local --output ./nooreat-livreur.apk

# Ou build local avec prebuild
npx expo prebuild --platform android
cd android
$env:JAVA_HOME = "C:\Program Files\Java\jdk-24"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat assembleDebug
```

## Build Automatique avec GitHub Actions

Le projet est configuré avec GitHub Actions pour build automatiquement les APKs.

### Configuration requise :
1. Forker le repo sur GitHub
2. Ajouter les secrets dans Settings > Secrets :
   - `EXPO_TOKEN` : Token Expo (pour build EAS)

### Lancer un build :
1. Pousser sur la branche `main`
2. Ou aller dans Actions > Build NOOR EAT Apps > Run workflow

Les APKs seront disponibles en tant qu'artifacts de workflow et dans les Releases.

## Résolution des Problèmes Courants

### "JAVA_HOME is set to an invalid directory"
Vérifiez que le chemin Java est correct et contient bien les dossiers `bin`, `lib`, etc.

### "SDK location not found"
Installez Android Studio et configurez `ANDROID_HOME` vers le dossier SDK.

### "Gradle build failed"
Nettoyez le projet :
```powershell
cd android
.\gradlew.bat clean
.\gradlew.bat assembleDebug
```

## Alternative : Utiliser Docker

Si vous avez Docker installé :

```bash
# Build avec image Android
docker run -v ${PWD}:/project -w /project/client-pwa/android \
  mingc/android-build-box:latest \
  ./gradlew assembleDebug
```

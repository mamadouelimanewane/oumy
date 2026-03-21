@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo ==========================================
echo 🏗️  SenFood APK Builder
echo ==========================================
echo.

set "RELEASE_DIR=%~dp0releases"
if not exist "%RELEASE_DIR%" mkdir "%RELEASE_DIR%"

:: Find Java
for /f "tokens=*" %%i in ('dir /b /s "C:\Program Files\Java\jdk*" 2^>nul ^| head -1') do set "JAVA_HOME=%%i"
if not defined JAVA_HOME (
    for /f "tokens=*" %%i in ('dir /b /s "C:\Program Files\Eclipse Adoptium\jdk*" 2^>nul ^| head -1') do set "JAVA_HOME=%%i"
)

if not defined JAVA_HOME (
    echo ❌ Java JDK not found. Please install Java 17 or higher.
    exit /b 1
)

echo 📍 Using Java: %JAVA_HOME%
set "PATH=%JAVA_HOME%\bin;%PATH%"

:: =====================
:: BUILD CLIENT PWA
:: =====================
echo.
echo 📱 Building Client PWA APK...
echo ------------------------------------------

cd /d "%~dp0client-pwa"

echo  → Installing dependencies...
call npm ci
if errorlevel 1 goto :error

echo  → Building web app...
call npm run build
if errorlevel 1 goto :error

echo  → Syncing with Capacitor...
call npx cap sync android
if errorlevel 1 goto :error

cd android

echo  → Building APK...
call gradlew.bat assembleDebug
if errorlevel 1 goto :error

copy /Y "app\build\outputs\apk\debug\app-debug.apk" "..\..\releases\SenFood-Client.apk" >nul
echo  ✅ Client APK built successfully!

cd /d "%~dp0"

:: =====================
:: BUILD ADMIN PANEL
:: =====================
echo.
echo 🎛️  Building Admin Panel APK...
echo ------------------------------------------

cd /d "%~dp0panel-admin"

echo  → Installing dependencies...
call npm ci
if errorlevel 1 goto :error

echo  → Building web app...
call npm run build
if errorlevel 1 goto :error

echo  → Syncing with Capacitor...
call npx cap sync android
if errorlevel 1 goto :error

cd android

echo  → Building APK...
call gradlew.bat assembleDebug
if errorlevel 1 goto :error

copy /Y "app\build\outputs\apk\debug\app-debug.apk" "..\..\releases\SenFood-Admin.apk" >nul
echo  ✅ Admin APK built successfully!

cd /d "%~dp0"

:: =====================
:: BUILD LIVREUR APP
:: =====================
echo.
echo 🚚 Building Livreur APK...
echo ------------------------------------------

cd /d "%~dp0app-livreur"

echo  → Installing dependencies...
call npm ci
if errorlevel 1 goto :error

echo  → Prebuilding for Android...
call npx expo prebuild --platform android --clean
if errorlevel 1 goto :error

cd android

echo  → Building APK...
call gradlew.bat assembleDebug
if errorlevel 1 goto :error

copy /Y "app\build\outputs\apk\debug\app-debug.apk" "..\..\releases\SenFood-Livreur.apk" >nul
echo  ✅ Livreur APK built successfully!

cd /d "%~dp0"

:: =====================
:: SUMMARY
:: =====================
echo.
echo ==========================================
echo ✨ Build Complete!
echo ==========================================
echo.
echo 📦 Generated APKs:
for %%f in ("%RELEASE_DIR%\*.apk") do (
    for %%A in ("%%f") do set "size=%%~zA"
    echo    • %%~nxf (!size! bytes)
)
echo.
echo 📂 APKs are ready in: %RELEASE_DIR%
echo.
pause
exit /b 0

:error
echo.
echo ❌ Build failed with error code %errorlevel%
echo.
pause
exit /b 1

# 🇸🇳 SenFood - Plateforme de Livraison de Repas (Sénégal)

[![Build Status](https://github.com/mamadouelimanewane/oumy/workflows/Build%20SenFood%20Apps/badge.svg)](https://github.com/mamadouelimanewane/oumy/actions)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/mamadouelimanewane/oumy/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 🚀 Présentation

SenFood est une plateforme complète de livraison de repas style UberEats, dédiée au marché Sénégalais. Elle connecte **clients**, **restaurants** et **livreurs** en temps réel.

### ✨ Fonctionnalités Clés

- 🔐 **Authentification JWT** sécurisée
- 💳 **Paiement** Wave & Orange Money
- 📍 **Suivi GPS** en temps réel
- 🔔 **Notifications** push instantanées
- 📊 **Dashboard** administrateur complet
- 🚀 **Temps réel** avec Socket.IO

## 📱 Les 4 Applications

| Application | Technologie | Description |
|-------------|-------------|-------------|
| **SenFood Client** | React PWA + Capacitor | Application client pour commander |
| **SenFood Restaurant** | React + Capacitor | Dashboard pour restaurants |
| **SenFood Livreur** | React Native + Expo | App mobile pour livreurs |
| **SenFood Admin** | React + Capacitor | Panel d'administration |

## 🛠️ Stack Technique

```
Backend:     Node.js + Express + PostgreSQL
Auth:        JWT + bcrypt
Real-time:   Socket.IO
Frontend:    React 19 + Vite + TailwindCSS
Mobile:      React Native 0.83 + Expo 55
Database:    PostgreSQL 15+
```

## 📦 Installation Rapide

### Prérequis
- Node.js 20+
- PostgreSQL 15+
- Java JDK 17+ (pour Android)

### 1. Cloner le projet
```bash
git clone https://github.com/mamadouelimanewane/oumy.git
cd oumy
```

### 2. Configurer le Backend
```bash
cd backend
cp .env.example .env
# Éditer .env avec vos configurations PostgreSQL
npm install
npm start
```

### 3. Lancer les applications
```bash
# Client PWA
cd client-pwa && npm install && npm run dev

# Restaurant Dashboard
cd dashboard-restaurant && npm install && npm run dev

# Admin Panel
cd panel-admin && npm install && npm run dev

# Livreur App
cd app-livreur && npm install && npx expo start
```

## 📲 Générer les APKs

### Méthode 1: Script Windows
```powershell
.\build-apks.bat
```

### Méthode 2: Manuellement
```bash
# Client APK
cd client-pwa
npm run build
npx cap sync android
cd android
./gradlew assembleDebug

# Admin APK
cd panel-admin
npm run build
npx cap sync android
cd android
./gradlew assembleDebug

# Livreur APK
cd app-livreur
eas build --platform android --profile preview
```

Les APKs seront générés dans le dossier `releases/`.

## 🔌 API Endpoints

### Authentification
```
POST /api/auth/register     → Inscription
POST /api/auth/login        → Connexion
GET  /api/auth/me           → Profil
```

### Client
```
GET  /api/client/restaurants      → Liste restaurants
GET  /api/client/plats            → Menu
POST /api/client/orders           → Créer commande
GET  /api/client/orders           → Historique
```

### Restaurant
```
GET  /api/restaurant/orders/active → Commandes en cours
PUT  /api/restaurant/orders/:id/status → Mettre à jour
GET  /api/restaurant/menu          → Menu
POST /api/restaurant/menu          → Ajouter plat
GET  /api/restaurant/stats         → Statistiques
```

### Livreur
```
POST /api/livreur/location              → Position GPS
GET  /api/livreur/orders/available      → Commandes dispo
POST /api/livreur/orders/:id/accept     → Accepter
POST /api/livreur/orders/:id/complete   → Livrer
```

## 🧪 Tests

```bash
cd backend
npm test
```

## 📁 Structure du Projet

```
SenFood/
├── backend/              # API Node.js + Express
│   ├── config/          # Configuration DB
│   ├── middleware/      # Auth JWT
│   ├── routes/          # API routes
│   └── tests/           # Tests Jest
├── client-pwa/          # Application Client
├── dashboard-restaurant/# Dashboard Restaurant
├── panel-admin/         # Panel Admin
├── app-livreur/         # App Mobile Livreur
├── releases/            # APKs générés
└── .github/workflows/   # CI/CD GitHub Actions
```

## 🔒 Sécurité

- ✅ JWT Authentication
- ✅ bcrypt Password Hashing
- ✅ Input Validation (express-validator)
- ✅ SQL Injection Protection
- ✅ CORS Configuration

## 🚀 Déploiement

### Production Checklist
- [ ] Configurer variables d'environnement
- [ ] Migrer vers PostgreSQL cloud (AWS RDS, etc.)
- [ ] Configurer HTTPS
- [ ] Activer rate limiting
- [ ] Configurer monitoring

## 📄 Documentation

- [Rapport Technique Complet](./RAPPORT_TECHNIQUE.md)
- [Guide de Déploiement](./DEPLOYMENT.md)
- [API Reference](./API.md)

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](./CONTRIBUTING.md)

## 📜 License

MIT License - voir [LICENSE](./LICENSE)

## 👨‍💻 Auteur

**Mamadou Elimane Nwane** - Développé avec ❤️ pour Oumy Dia et le Sénégal 🇸🇳

---

⭐ **Star ce repo si vous trouvez ce projet utile !**

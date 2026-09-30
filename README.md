# 🎬 CineTube

> **CineTube** ist eine moderne, Netflix-inspirierte Web-Applikation zur Präsentation und Wiedergabe kuratierter Spielfilme aus YouTube-Playlists. Ausgestattet mit automatischer KI-Filminfo-Anreicherung (Google Gemini), persönlicher Watchlist, rollenbasiertem Admin-Bereich und nativer Tablet-Optimierung.

<img width="1730" height="1002" alt="cinetube" src="https://github.com/user-attachments/assets/a44fa416-cd66-4084-8fa2-548b387480bc" />

## ✨ Features

### 🍿 Benutzeroberfläche (Netflix-Style)
- **Dynamischer Hero-Bereich:** Automatisch rotierende Film-Highlights mit Trailer-Start und Schnellinfo.
- **Kategorien & Karussells:** Horizontale Filmzeilen für *Neuerscheinungen*, *Für Dich ausgewählt*, *Beliebt auf CineTube*, *Empfehlungen* und *Alle*.
- **Intelligente Schnellsuche:** Volltextsuche über Titel, Inhaltsangabe, Schauspieler, Regie und Genres.
- **Genre-Leiste:** Schnelles Filtern nach Genres (z. B. Action, Drama, Komödie, Sci-Fi, Thriller).
- **Vollbild-Modus:** Nahtloser Vollbild-Genuss auf Knopfdruck.

### 🤖 KI-gestützte Filminformationen (Google Gemini)
- Erkennt anhand des YouTube-Videotitels automatisch den echten Filmtitel.
- Reichert Filme mit Inhaltsangabe (Overview), Erscheinungsjahr, FSK/Bewertung, Laufzeit, Regisseur und Hauptdarstellern an.
- Speichert und cached alle Filminfos dauerhaft in Google Cloud Firestore.

### 🛠️ Admin-Funktionen
- **Admin-Modus:** Schnelles Umschalten zwischen Nutzer- und Administrator-Ansicht.
- **Empfehlungen verwalten:** Filme mit einem Klick zu den globalen *CineTube-Empfehlungen* hinzufügen (Trophäen-Button).
- **Papierkorb & Ausblenden:** Unerwünschte oder gelöschte Videos ausblenden, wiederherstellen oder dauerhaft aus der Datenbank entfernen.
- **Suchbegriff-Korrektur:** Bei komplexen YouTube-Titeln (z. B. *"Diesen Film musst Du sehen..."*) kann der Admin einen manuellen Suchtitel hinterlegen, damit die KI sofort die perfekten Filminformationen findet.
- **Kategorien-Editor:** Film-Genres können direkt im Info-Dialog bearbeitet oder ergänzt werden.
- **DB-Check / Differenzansicht:** Überprüft, welche Videos aus der YouTube-Playlist noch keine Metadaten in Firestore haben, und synchronisiert diese auf Knopfdruck.

### 📋 Persönliche Watchlist ("Meine Liste")
- Jeder angemeldete Benutzer kann Filme mit dem `(+)` / `Bookmark`-Button in seine persönliche Watchlist ablegen.
- Nahtlose Echtzeit-Synchronisation via Firebase Firestore.

### 📱 Tablet- & Mobile-Optimierung
- **Screen Wake Lock API:** Verhindert das automatische Abdunkeln oder Sperren des Tablet-Bildschirms nach 2 Minuten Inaktivität beim Stöbern oder Filmschauen.
- **Touch-freundliches Layout:** Saubere Trennung der Aktions-Buttons ohne Überlappungen oder Klick-Konflikte.
- **Inline-Player (`playsinline`):** Optimierte Videowiedergabe für iPadOS und Android-Tablets.

---

## 🚀 Tech Stack

- **Frontend:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/) Icons, [Motion](https://motion.dev/)
- **Backend / Server:** [Express](https://expressjs.com/) (Node.js / tsx)
- **Datenbank & Auth:** [Firebase Authentication](https://firebase.google.com/) & [Cloud Firestore](https://firebase.google.com/docs/firestore)
- **Künstliche Intelligenz:** [Google Gemini API](https://ai.google.dev/) (`@google/genai`)
- **Video-Player:** [react-youtube](https://github.com/tjallingt/react-youtube) (YouTube IFrame Player API)

---

## 📦 Installation & Lokales Setup

### Voraussetzungen
- **Node.js** (v20 oder neuer empfohlen)
- **npm** oder **bun**
- Ein **Google Cloud** Projekt mit aktivierter **YouTube Data API v3**
- Ein **Google AI Studio** API-Key für Gemini
- Ein **Firebase** Projekt (Authentication & Firestore)

### 1. Repository klonen
```bash
git clone https://github.com/DEIN-BENUTZERNAME/cinetube.git
cd cinetube
```

### 2. Abhängigkeiten installieren
```bash
npm install
```

### 3. Umgebungsvariablen einrichten
Erstelle eine `.env`-Datei im Stammverzeichnis basierend auf `.env.example`:

```bash
cp .env.example .env
```

Fülle die Werte in der `.env`-Datei aus:

```env
# URL der gehosteten Applikation
APP_URL="http://localhost:3000"

# YouTube Data API Key (https://console.cloud.google.com/apis/library/youtube.googleapis.com)
VITE_YOUTUBE_API_KEY="DEIN_YOUTUBE_API_KEY"

# Gemini API Key für Film-Metadaten (https://aistudio.google.com/app/apikey)
GEMINI_API_KEY="DEIN_GEMINI_API_KEY"
```

> **Hinweis zur Firebase-Konfiguration:**
> Die Firebase-Zugangsdaten liegen in `firebase-applet-config.json` bzw. werden in `src/firebase.ts` initialisiert.

### 4. Playlist-ID und Admin-E-Mail anpassen (optional)
In `src/App.tsx` können die Standard-YouTube-Playlist und die Admin-E-Mail konfiguriert werden:

```typescript
const PLAYLIST_ID = 'DEINE_YOUTUBE_PLAYLIST_ID';
const ADMIN_EMAIL = 'deine-email@gmail.com';
```

---

## 🛠️ Verfügbare Skripte

| Befehl | Beschreibung |
| :--- | :--- |
| `npm run dev` | Startet den Express- und Vite-Entwicklungsserver auf Port 3000 |
| `npm run build` | Erstellt das produktionsreife Frontend-Bundle im Ordner `dist` |
| `npm run start` | Startet den Produktionsserver (`server.ts`) |
| `npm run lint` | Führt die TypeScript-Typüberprüfung (`tsc --noEmit`) aus |
| `npm run clean` | Löscht den `dist`-Build-Ordner |

---

## 📁 Projektstruktur

```
├── src/
│   ├── components/
│   │   ├── DifferenceView.tsx   # DB-Check & Synchronisation
│   │   ├── Hero.tsx             # Netflix-Style Film-Banner
│   │   ├── LoginWall.tsx        # Anmelde-Bildschirm
│   │   ├── MovieInfoModal.tsx   # Detailansicht & KI-Metadaten
│   │   ├── MovieRow.tsx         # Horizontales Film-Karussell
│   │   ├── PlayerModal.tsx      # YouTube Video-Player Dialog
│   │   └── Thumbnail.tsx        # Zuverlässiger Fallback-Thumbnail Loader
│   ├── services/
│   │   ├── gemini.ts            # Gemini API Client
│   │   ├── movieInfo.ts         # KI-Analyse & Metadaten-Cache
│   │   ├── wakeLock.ts          # Screen Wake Lock (Tablet Anti-Dimming)
│   │   └── youtube.ts           # YouTube Data API Anbindung
│   ├── firebase.ts              # Firebase & Firestore Initialisierung
│   ├── types.ts                 # TypeScript Typdefinitionen
│   ├── App.tsx                  # Hauptkomponente & Routing
│   └── main.tsx                 # React Einstiegspunkt
├── server.ts                    # Express Server & API-Proxy
├── firestore.rules              # Firestore Sicherheitsregeln
├── package.json
└── vite.config.ts
```

---

## 📄 Lizenz

Dieses Projekt ist für den privaten Gebrauch und zur Präsentation kuratierter YouTube-Inhalte erstellt. Alle YouTube-Inhalte unterliegen den Rechten der jeweiligen Urheber und den Nutzungsbedingungen von YouTube.
<img width="1730" height="1002" alt="cinetube" src="https://github.com/user-attachments/assets/c2975ae3-217b-41a1-b189-d065a8a16f9c" />
<img width="1730" height="1002" alt="cinetube" src="https://github.com/user-attachments/assets/a442778f-aa2c-4357-8bb5-b9a1813e84b2" />

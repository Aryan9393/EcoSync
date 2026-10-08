# EcoSync

**A second life for your scrap.**
Scan it, sell it to a collector nearby, and follow it to its next life with a QR material passport.
Built for TECHBEANS 7.0 · FutureWebX (topic: *Waste Recycling Service*).

- **No API keys.** Everything runs out of the box.
- **Real database.** Postgres on [Neon](https://neon.tech) (or a local Postgres file when no database is set).
- **Real AI, on the device.** The scanner runs MobileNet in the browser with TensorFlow.js.
- **Real payments.** Buyers pay sellers directly by UPI (QR or app link) or cash; a QR handshake at pickup completes the sale.
- **Real places.** Recycling centres, e-waste points and scrap yards from OpenStreetMap; 3D buildings from OpenFreeMap.

| Brief asks for | EcoSync |
|---|---|
| Pickup scheduling | 7-day slot picker, pickup codes, route preview, Green Route slots (+25 coins when a pickup is already booked nearby) |
| Recycling rewards | EcoCoins for listing, selling, pickups, reporting and cleaning litter; tiers; redeemable rewards; Ward Wars |
| One unique feature | QR material passport + handshake: every sale has a passport that records each handover |

## Run it

```bash
npm install
npm start          # http://localhost:8080
```
Without `DATABASE_URL`, data is stored in `./data/pglite` (real Postgres via PGlite).

## Connect Neon (2 minutes)

1. Sign up at [neon.tech](https://neon.tech) → **New project** (region: Singapore is closest to India).
2. Click **Connect** and copy the connection string (`postgresql://…neon.tech/neondb?sslmode=require`).
3. On Render → your service → **Environment** → add `DATABASE_URL` = that string → Save.

Tables are created automatically on first start: `users`, `txns`, `listings`, `passports`, `pickups`, `reports`, `settings`.

## Deploy on Render

Service settings: **Build Command** `npm install` · **Start Command** `npm start` · Node 22 (pinned by `.node-version`).
Or use **New → Blueprint** with this repo (`render.yaml`).

## Android app

`public/downloads/EcoSync.apk` is served at `/download/android`. It opens straight to the scanner with camera, GPS and photo uploads. The **Android APK** GitHub Action rebuilds and signs it on every change to `android/`, and publishes it under **Releases → android-latest**.

## How it fits together

```
server.js              Express API + static site
lib/db.js              Postgres (Neon via node-postgres, or PGlite locally) + schema
lib/hubs.js            OpenStreetMap recycling places (Overpass API)
lib/ecobot.js          EcoBot knowledge base, Hindi listing parser, upcycling ideas
lib/materials.js       Rates (₹/kg) and CO₂ factors for 17 materials
public/                The web app (no build step)
  js/landing.js        Landing page + guided tour
  js/materials.js      On-device scanner (TensorFlow.js MobileNet)
  js/mock.js           In-browser backend for static previews
android/               Native Android WebView app (smali) + build.sh
```

Passwords are stored as salted scrypt hashes; sessions are signed JWTs. Public passport pages show shortened names only, never addresses.

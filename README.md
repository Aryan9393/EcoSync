# EcoSync

**Scan it. Sell it. See what it becomes.**
A waste-recycling service for Indian homes and scrap collectors — built for TECHBEANS 7.0 · FutureWebX (topic: *Waste Recycling Service*).

EcoSync covers the three required pieces — **pickup scheduling**, **recycling rewards** and **a unique feature** — and adds an AI scanner, a buyer/seller marketplace, secure payments, QR material passports, live recycling-hub maps, a 3D litter map and an Android app.

| | |
|---|---|
| Web app | Node.js + Express server, vanilla JS front end (no build step) |
| AI | Google Gemini (`gemini-3.8-flash` for vision/chat, `gemini-nano-banana-2.1` for images) |
| Maps | Leaflet + OpenStreetMap/CARTO (2D), MapLibre + OpenFreeMap (3D buildings), Overpass API (real recycling hubs), Google Street View links |
| Sign-in | Email one-time codes (Resend) **or** Firebase Auth (Google, email/password, email link) |
| Payments | Razorpay (UPI, cards, netbanking) with escrow released by QR handshake |
| Android | Native WebView app (`android/`), built by GitHub Actions |

Every external service is optional. Without keys the app runs in a labelled **demo mode** (sample AI answers, test payments, sign-in codes shown on screen), so it always works for a live demo.

---

## Run it locally

```bash
npm install
npm start            # http://localhost:8080
```
Copy `.env.example` to `.env` and fill in whichever keys you have.

## Deploy on Render (from GitHub)

1. Push this folder to `github.com/Aryan9393/EcoSync` (see below).
2. On [render.com](https://render.com): **New → Blueprint** → pick the EcoSync repo. Render reads `render.yaml` and creates the `ecosync` web service.
3. Open the service → **Environment** and paste your keys (all optional):
   - `GEMINI_API_KEY` — from https://aistudio.google.com/apikey
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — Razorpay Dashboard → Settings → API keys (test keys are fine)
   - `RESEND_API_KEY` — for real sign-in emails, **or** the four `FIREBASE_*` values for Firebase Auth
4. Deploy. Your site is at `https://ecosync.onrender.com` (or the name Render gives you).

> Free Render instances sleep after 15 minutes idle; the first visit then takes ~30 s. Open the site a minute before your audition. Data is stored in a JSON file; attach a Render Disk at `/var/data` to keep it across deploys.

### Push to GitHub
```bash
git remote add origin https://github.com/Aryan9393/EcoSync.git   # skip if already set
git push -u origin main
```

## Android app (APK)

- A ready APK is included at `public/downloads/EcoSync.apk` and is served from `/download/android` on your site.
- It opens straight to the AI scanner, with camera, GPS and photo uploads enabled. On first launch it connects to `https://ecosync.onrender.com`; if your Render URL is different, it asks you for the address once.
- **Rebuild with your URL:** in GitHub → Settings → Secrets and variables → Actions → **Variables**, add `APP_URL` = your Render URL, then run the **Android APK** workflow (Actions tab). The signed APK appears under **Releases → android-latest**. To keep the same signing key between builds, add a base64 keystore as the `KEYSTORE_BASE64` secret (and `KS_PASS`).
- Install: open the APK on the phone and allow "Install unknown apps".

## Firebase sign-in (optional)

1. Create a Firebase project → **Authentication** → enable **Email/Password**, **Email link** and **Google**.
2. **Authentication → Settings → Authorized domains** → add your Render domain.
3. Project settings → your web app → copy `apiKey`, `projectId`, `authDomain`, `appId` into the `FIREBASE_*` env vars.

## Razorpay (optional)

Use test keys (`rzp_test_…`). In test mode, pay with UPI ID `success@razorpay` or card `4111 1111 1111 1111`, any future expiry, any CVV. The server verifies the payment signature before creating the passport.

## AI imagery

`GEMINI_API_KEY=… npm run gen:images` generates six images with Gemini into `public/img/ai/`; the landing page then shows a "Second life" gallery. Upcycle Studio also generates an image for every scanned item at runtime.

## Project layout

```
server.js            API + static hosting
lib/                 gemini.js · hubs.js (OpenStreetMap) · db.js · materials.js · demo-ai.js
public/              the web app (index.html, css/, js/, icons/, manifest, service worker)
public/js/mock.js    in-browser backend used when no server is reachable (static previews)
android/             native Android project (smali WebView shell) + build.sh
.github/workflows/   Android APK build
render.yaml          Render Blueprint
Dockerfile           Cloud Run / Google AI Studio deploys
docs/PITCH.md        feature list, demo script and judge Q&A
```

## API

`GET /api/config` · `POST /api/auth/otp/request|verify` · `POST /api/auth/firebase` · `GET|PATCH /api/me`
`POST /api/ai/scan|chat|upcycle|parse-listing|image` · `GET /api/hubs`
`GET|POST /api/listings` · `POST /api/pay/order|verify` · `GET /api/passport/:id` · `POST /api/passport/:id/handshake|event`
`GET /api/pickups/slots` · `POST /api/pickups` · `GET|POST /api/reports` · `GET /api/wallet` · `POST /api/rewards/redeem` · `GET /api/leaderboard`

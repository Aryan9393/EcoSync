# EcoSync — context for Gemini agents (AI Studio, Antigravity, Gemini CLI)

Waste-recycling marketplace for India. Node 22 + Express (`server.js`), vanilla-JS front end in `public/` (no build step), Postgres via `lib/db.js`.

- Start: `npm install && npm start` (listens on `$PORT`, default 8080). No keys required.
- Database: `DATABASE_URL` (Neon) → node-postgres; otherwise PGlite in `./data/pglite`. Schema is created on boot in `lib/db.js`.
- Scanner: TensorFlow.js MobileNet in the browser (`public/js/materials.js`). If `GEMINI_API_KEY` is set on the server, `/api/ai/scan` and `/api/ai/chat` use Gemini instead.
- `public/js/mock.js` mirrors the API for static previews; keep it in sync with new routes.
- Design: Plinth-inspired. Tokens at the top of `public/css/app.css`; Instrument Serif headlines, Manrope body, cream mockups with green #1d5a43.
- Copy: sentence case, plain verbs, no fake people or fake stats.

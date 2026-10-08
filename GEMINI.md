# EcoSync — context for Gemini agents (Antigravity, Gemini CLI, AI Studio)

EcoSync is a waste-recycling marketplace for India. Node 22 + Express server (`server.js`) serving a no-build vanilla-JS front end from `public/`.

- Start: `npm install && npm start` (listens on `$PORT`, default 8080).
- AI calls go through `lib/gemini.js` and read `GEMINI_API_KEY` from the server environment. Never expose the key to the browser.
- Default models: `gemini-3.8-flash` (vision + chat, falls back to `gemini-flash-latest`) and `gemini-nano-banana-2.1` (images). Override with `GEMINI_MODEL` / `GEMINI_IMAGE_MODEL`.
- `public/js/mock.js` mirrors the API for static previews; keep it in sync when you add routes to `server.js`.
- Design tokens live at the top of `public/css/app.css` (dark-first, mint→sky accent, kraft gold for coins). Fonts: Unbounded (display), Instrument Sans (body), JetBrains Mono (IDs).
- Copy style: sentence case, plain verbs, buttons say exactly what happens.
- Data is a JSON file (`lib/db.js`). For production, move it to Firestore.

# Running EcoSync in a Gemini workspace

This zip is set up for Google's Gemini tools. The server reads `GEMINI_API_KEY` from its environment, which is exactly how AI Studio stores your key (as a server-side secret).

## Option 1 — Google AI Studio (Build mode) → Cloud Run
1. Put this folder in a GitHub repo (or use github.com/Aryan9393/EcoSync).
2. Open https://aistudio.google.com → **Build** → in the prompt box open the **+** menu → **Import from GitHub** → choose the repo.
3. AI Studio provides `GEMINI_API_KEY` automatically (see the **Secrets** panel). Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RESEND_API_KEY` there too if you have them.
4. `metadata.json` asks for camera, location and microphone access so the scanner, maps and voice listing work inside the preview.
5. Click **Deploy** → Cloud Run. The included `Dockerfile` builds the app.

## Option 2 — Google Antigravity or Gemini CLI
1. Unzip, open the folder in Antigravity (or run `gemini` inside it). `GEMINI.md` gives the agent the project context.
2. `cp .env.example .env`, paste your Gemini key, then `npm install && npm start`.
3. Ask the agent things like "add a Tamil language option to EcoBot" — it knows where everything lives.

## Option 3 — an existing Firebase Studio workspace
Firebase Studio no longer accepts new imports (since June 2026), but existing workspaces still run. Upload the folder; `.idx/dev.nix` installs Node 22, runs `npm ci` and starts the preview.

## Generate the AI imagery
```bash
GEMINI_API_KEY=your-key npm run gen:images
```
Creates six Gemini images in `public/img/ai/` for the landing-page gallery.

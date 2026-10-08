# Running EcoSync in a Gemini workspace

EcoSync needs no API keys. It runs as-is in Google AI Studio, Antigravity or any Node host.

## Google AI Studio (Build mode) → Cloud Run
1. Open https://aistudio.google.com → **Build** → **+** → **Import from GitHub** → `Aryan9393/EcoSync`.
2. Optional: in **Secrets**, add `DATABASE_URL` (your Neon connection string) so data persists.
3. `metadata.json` requests camera, location and microphone for the scanner, maps and voice listing.
4. **Deploy** → Cloud Run (uses the included `Dockerfile`).

## Google Antigravity or Gemini CLI
Unzip, open the folder, then `npm install && npm start`. `GEMINI.md` gives the agent the project context.

## Existing Firebase Studio workspace
New imports closed in June 2026, but existing workspaces still work: `.idx/dev.nix` installs Node 22, runs `npm ci` and starts the preview.

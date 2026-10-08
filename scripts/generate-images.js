// Generates the AI imagery used on the landing page with Gemini's image model.
// Run once after adding your key:   GEMINI_API_KEY=xxx npm run gen:images
// Images are saved to public/img/ai/ and listed in public/img/ai/index.json,
// which the landing page reads to show the "Second life" gallery.
import fs from 'node:fs';
import path from 'node:path';
import { geminiImage, aiEnabled, MODELS } from '../lib/gemini.js';

if (!aiEnabled()) { console.error('Set GEMINI_API_KEY first.'); process.exit(1); }
const OUT = path.resolve('public/img/ai');
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [
  ['hero-city', 'Futuristic Indian neighbourhood at dusk with clean streets, a small electric recycling van collecting sorted bags, soft teal and mint lighting, cinematic, photorealistic, no text'],
  ['pet-to-shirt', 'Clean PET plastic bottles transforming into a folded green polyester t-shirt, studio product photo, dark teal background, soft light, no text'],
  ['paper-to-notebook', 'Bundle of old newspapers next to a new recycled-paper notebook with a kraft cover, overhead flat lay on dark slate, soft daylight, no text'],
  ['cans-to-bike', 'Crushed aluminium cans beside a sleek aluminium bicycle frame, studio photo, teal rim light, minimal, no text'],
  ['ewaste-to-gold', 'An old circuit board with tiny recovered gold and copper granules on a lab tray, macro photography, dark background, no text'],
  ['kabadiwala', 'Friendly Indian scrap collector with a cycle cart of neatly sorted cardboard and bottles in a residential lane, morning light, documentary photo style, no text'],
];
const index = [];
for (const [name, prompt] of SHOTS) {
  process.stdout.write(`Generating ${name}… `);
  try {
    const dataUrl = await geminiImage(prompt);
    const [, mime, b64] = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    const file = `${name}.${mime.includes('png') ? 'png' : 'jpg'}`;
    fs.writeFileSync(path.join(OUT, file), Buffer.from(b64, 'base64'));
    index.push({ file, name, prompt });
    console.log('done');
  } catch (e) { console.log('failed:', e.message); }
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ model: MODELS.image, images: index }, null, 2));
console.log(`Saved ${index.length} images to public/img/ai/`);

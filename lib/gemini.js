// Gemini REST client. Key stays on the server (never shipped to the browser).
// Model IDs can be overridden with env vars when Google ships newer ones.
const KEY = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
export const aiEnabled = () => !!KEY();
export const MODELS = {
  text: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  // Fast fallbacks, tried when the main model errors, is overloaded or is slow.
  fallback: ['gemini-3.5-flash-lite', 'gemini-flash-latest'],
  image: process.env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1',
};
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

async function call(model, body, ms) {
  const r = await fetch(`${BASE}/${model}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY() }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data?.error?.message || `Gemini ${r.status}`); e.status = r.status; throw e; }
  return data;
}
// Low "thinking" keeps answers fast. If a model doesn't accept the setting, retry without it.
async function callFast(model, body, ms) {
  const fast = { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingLevel: 'low' } } };
  try { return await call(model, fast, ms); }
  catch (e) { if (e.status === 400 && /thinking/i.test(e.message)) return call(model, body, ms); throw e; }
}
async function withFallback(body, models) {
  let last;
  for (const [i, m] of models.entries()) {
    try { return await callFast(m, body, i === 0 ? 22_000 : 18_000); }
    catch (e) { last = e; console.error(`Gemini ${m} failed: ${e.message}`); }
  }
  throw last;
}

export async function gemini({ prompt, system, history, image, mime, json }) {
  // Gemini needs the conversation to start with the user and alternate roles.
  const turns = [];
  for (const m of history || []) {
    if (!m.text) continue;
    if (!turns.length && m.role !== 'user') continue;
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) last.parts[0].text += '\n\n' + m.text; else turns.push({ role: m.role, parts: [{ text: m.text }] });
  }
  const contents = history
    ? turns
    : [{ role: 'user', parts: [{ text: prompt }, ...(image ? [{ inline_data: { mime_type: mime, data: image.replace(/^data:[^,]+,/, '') } }] : [])] }];
  if (!contents.length) throw new Error('Empty conversation');
  const body = { contents, generationConfig: { temperature: json ? 0.2 : 0.7, ...(json ? { responseMimeType: 'application/json' } : {}) } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const data = await withFallback(body, [MODELS.text, ...MODELS.fallback]);
  const text = data?.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text || '').join('') || '';
  if (!text) throw new Error(`Gemini returned no text (${data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'unknown'})`);
  if (!json) return text.trim();
  const raw = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  try { return JSON.parse(raw); } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) try { return JSON.parse(m[0]); } catch {} throw new Error('AI returned an unreadable answer: ' + raw.slice(0, 120)); }
}

export async function geminiImage(prompt) {
  const data = await call(MODELS.image, { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } });
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
  const d = part?.inlineData || part?.inline_data;
  if (!d) throw new Error('No image returned');
  return `data:${d.mimeType || d.mime_type || 'image/png'};base64,${d.data}`;
}

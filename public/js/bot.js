import { post } from './api.js';
import { $, esc, toast } from './ui.js';
import { icon } from './icons.js';

const history = [];
export async function render(host) {
  host.innerHTML = `<div class="page-head"><div><span class="eyebrow">EcoBot</span><h1>Ask anything<br>about waste.</h1><p>Sorting rules, scrap prices, e-waste, composting. Hindi, Hinglish or English.</p></div></div>
    <div class="chat"><div class="msgs" id="msgs" aria-live="polite"></div>
      <form class="composer" id="cmp"><button type="button" class="icon-btn" id="b-mic" aria-label="Speak">${icon('mic')}</button><input class="input grow" id="b-in" placeholder="Where do old batteries go?" autocomplete="off" aria-label="Message"><button class="btn btn-primary" type="submit" aria-label="Send">${icon('send')}</button></form></div>`;
  const msgs = $('#msgs');
  const add = (role, text) => { const d = document.createElement('div'); d.className = `msg ${role === 'user' ? 'me' : 'bot'}`; d.textContent = text; msgs.append(d); msgs.scrollTop = msgs.scrollHeight; return d; };
  if (!history.length) history.push({ role: 'model', text: 'Namaste! Ask me what goes in which bin, what your scrap is worth, or where to drop off e-waste.' });
  history.forEach((m) => add(m.role, m.text));
  const sugg = document.createElement('div'); sugg.className = 'chips';
  sugg.innerHTML = ['Where do old batteries go?', 'Akhbaar ka rate kya hai?', 'How do I compost at home?', 'Is a pizza box recyclable?'].map((q) => `<button class="chip" type="button">${esc(q)}</button>`).join('');
  msgs.append(sugg);
  sugg.onclick = (e) => { const b = e.target.closest('button'); if (b) { $('#b-in').value = b.textContent; $('#cmp').requestSubmit(); } };
  $('#cmp').onsubmit = async (e) => {
    e.preventDefault(); const inp = $('#b-in'), text = inp.value.trim(); if (!text) return;
    inp.value = ''; sugg.remove(); history.push({ role: 'user', text }); add('user', text);
    const t = add('model', ''); t.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    try { const r = await post('/api/ai/chat', { messages: history.slice(-12) }); t.textContent = r.text; history.push({ role: 'model', text: r.text }); }
    catch (er) { t.textContent = er.message; }
    msgs.scrollTop = msgs.scrollHeight;
  };
  $('#b-mic').onclick = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return toast('Voice input isn\'t available in this browser.', 'err');
    const r = new SR(); r.lang = 'hi-IN'; r.onresult = (e) => { $('#b-in').value = e.results[0][0].transcript; $('#cmp').requestSubmit(); }; r.onerror = () => toast('Didn\'t catch that. Try again.', 'err'); r.start(); toast('Listening…');
  };
}

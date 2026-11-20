// المرحلة ٤: نموذج الطبقات + محرر بصري بسيط
// كل طبقة: {type:'text'|'rect', x,y (٠..١ نسبة), text, size, color, rot, opacity}
import { state, $, toast, esc, loadFont } from './state.js';
import { textAt } from './ai.js';
export const addLayer = (i, layer) => (state.layers[i] ||= []).push(layer);

// لف النص على أسطر حسب العرض المتاح
function wrap(ctx, text, maxW) {
  const lines = []; let cur = '';
  for (const word of String(text).split(/\s+/)) {
    const t = cur ? cur + ' ' + word : word;
    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = word; } else cur = t;
  }
  if (cur) lines.push(cur); return lines;
}
// رسم الطبقات فوق الصورة — بيستخدمها التصدير والمعاينة
export function drawLayers(ctx, layers = [], w, h) {
  for (const L of layers) {
    ctx.save(); ctx.globalAlpha = L.opacity ?? 1;
    ctx.translate(L.x * w, L.y * h); ctx.rotate((L.rot || 0) * Math.PI / 180);
    if (L.type === 'rect') { ctx.fillStyle = L.color || '#fff'; ctx.fillRect(0, 0, (L.w || .1) * w, (L.h || .1) * h); }
    else {
      const size = (L.size || 0.06) * h;
      ctx.font = `700 ${size}px Cairo, sans-serif`; ctx.fillStyle = L.color || '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'rtl';
      ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(2, h * 0.006); ctx.lineJoin = 'round';
      const lines = wrap(ctx, L.text, w * 0.9), lh = size * 1.3;
      lines.forEach((ln, k) => { const y = (k - (lines.length - 1)) * lh; ctx.strokeText(ln, 0, y); ctx.fillText(ln, 0, y); });
    }
    ctx.restore();
  }
}

let cur = 0, pos = { x: .5, y: .88 };
const cv = () => $('#ed-canvas');
async function render() {
  const n = state.frames.length, c = cv(), info = $('#ed-info');
  $('#ed-empty').hidden = n > 0; $('#ed-body').hidden = n === 0;
  if (!n) return;
  cur = Math.min(cur, n - 1);
  $('#ed-slider').max = n; $('#ed-slider').value = cur + 1; $('#ed-frame').value = cur + 1; $('#ed-pos').textContent = `${cur + 1} / ${n}`;
  const layers = state.layers[cur] || [];
  await loadFont(layers.map(l => l.text).join(' ') || 'أ');
  const bmp = await createImageBitmap(state.frames[cur].blob);
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0); bmp.close();
  drawLayers(ctx, layers, c.width, c.height);
  // علامة مكان النص الجديد
  ctx.save(); ctx.strokeStyle = '#ff7a8a'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(0, pos.y * c.height); ctx.lineTo(c.width, pos.y * c.height); ctx.stroke(); ctx.restore();
  $('#ed-layers').innerHTML = layers.map((l, k) =>
    `<li><span>${esc(l.text || l.type)}</span><button class="mini" data-del="${k}" aria-label="احذف الطبقة">حذف</button></li>`).join('') || '<li class="hint">مفيش طبقات على الفريم ده.</li>';
  info.textContent = `${Object.values(state.layers).reduce((a, l) => a + l.length, 0)} طبقة في المشروع كله.`;
}
export function initEditor() {
  document.addEventListener('step', (e) => e.detail === 'editor' && render());
  document.addEventListener('frames-ready', () => { cur = 0; render(); });
  $('#ed-slider').oninput = (e) => { cur = +e.target.value - 1; render(); };
  $('#ed-frame').onchange = (e) => { cur = Math.max(1, Math.min(state.frames.length, +e.target.value || 1)) - 1; render(); };
  $('#ed-prev').onclick = () => { cur = Math.max(0, cur - 1); render(); };
  $('#ed-next').onclick = () => { cur = Math.min(state.frames.length - 1, cur + 1); render(); };
  cv().onclick = (e) => { const r = cv().getBoundingClientRect(); pos = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; render(); };
  $('#ed-layers').onclick = (e) => {
    const k = e.target.dataset?.del; if (k == null) return;
    state.layers[cur].splice(+k, 1); render();
  };
  $('#ed-add').onclick = () => {
    const text = $('#ed-text').value.trim(); if (!text) return toast('اكتب النص الأول.');
    if (!state.frames.length) return toast('استخرج الفريمات الأول.');
    const layer = () => ({ type: 'text', text, x: pos.x, y: pos.y, size: +$('#ed-size').value / 100, color: $('#ed-color').value });
    if ($('#ed-all').checked) state.frames.forEach((_, i) => addLayer(i, layer())); else addLayer(cur, layer());
    render();
  };
  $('#ed-clear').onclick = () => { delete state.layers[cur]; render(); };
  $('#ed-subs').onclick = () => {
    if (!state.transcript.length) return toast('شغّل تحليل الصوت الأول من تبويب "ذكاء".');
    let n = 0;
    state.frames.forEach((_, i) => { const t = textAt(i); if (t) { addLayer(i, { type: 'text', text: t, x: .5, y: .92, size: .05, color: '#ffffff', sub: true }); n++; } });
    toast(`اتضافت ترجمة على ${n} فريم.`); render();
  };
}

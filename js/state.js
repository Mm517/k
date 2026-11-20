// الحالة المشتركة بين الوحدات
export const state = {
  file: null, duration: 0, fps: 5,
  frames: [],      // [{name, url, blob}]
  audio: null,     // Uint8Array (wav)
  layers: {},      // فهرس الفريم -> طبقات التعديل
  transcript: [], analysis: [],
  from: 0, to: 0, name: '',
};
export const $ = (s) => document.querySelector(s);
export function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 4500);
}
export function setBar(id, p) { $(id).style.width = Math.round(Math.min(Math.max(p, 0), 1) * 100) + '%'; }
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// تنظيف الذاكرة
export function clearFrames() {
  state.frames.forEach(f => URL.revokeObjectURL(f.url));
  state.frames = []; state.audio = null; state.layers = {}; state.transcript = []; state.analysis = [];
}
// تحميل خط Cairo قبل الرسم على Canvas (وإلا الرسم يطلع بخط مختلف)
export async function loadFont(sample = 'أ') {
  try { await document.fonts.load('700 40px Cairo', sample); } catch { /* تجاهل */ }
}

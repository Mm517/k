// المرحلة ٣: الذكاء الاصطناعي — بيكلّم Edge Function "gemini-analyze" (المفتاح عمره ما بيظهر هنا)
import { state, $, toast, esc } from './state.js';
import { sb } from './supabase.js';

// تحويل bytes لـ base64 على دفعات (الـ spread بيفجّر الستاك مع الملفات الكبيرة)
function b64(bytes) {
  let s = ''; const n = 0x8000;
  for (let i = 0; i < bytes.length; i += n) s += String.fromCharCode.apply(null, bytes.subarray(i, i + n));
  return btoa(s);
}
async function call(body) {
  const { data: { session } } = await sb().auth.getSession();
  if (!session) throw new Error('login');
  const { data, error } = await sb().functions.invoke('gemini-analyze', { body });
  if (error) {
    // الرسالة الحقيقية موجودة في جسم الرد مش في error.message
    let msg = error.message; try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch { /* تجاهل */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
// تحويل الصوت لنص بتوقيتات: [{start,end,text}]
export async function transcribe() {
  if (state.audio.length > 14e6) throw new Error('audio-too-long'); // ~7 دقايق
  const d = await call({ task: 'transcribe', audio: b64(state.audio) });
  return (d.segments || []).map(s => ({ start: +s.start || 0, end: +s.end || 0, text: String(s.text || '') }));
}
// وصف فريم: {scene, objects, text, mood}
export async function describeFrame(i) {
  const buf = new Uint8Array(await state.frames[i].blob.arrayBuffer());
  return call({ task: 'describe', image: b64(buf) });
}
// الكلام اللي اتقال وقت الفريم i
export const textAt = (i) => {
  const t = i / state.fps;
  return state.transcript.filter(s => s.start <= t + 0.5 && s.end >= t - 0.5).map(s => s.text).join(' ');
};

export function initAI() {
  $('#run-ai').onclick = async () => {
    if (!state.frames.length) return toast('استخرج الفريمات الأول.');
    const btn = $('#run-ai'), out = $('#ai-out'); btn.disabled = true;
    try {
      if (state.audio?.length) { out.textContent = 'بحوّل الصوت لنص…'; state.transcript = await transcribe(); }
      // نحلّل حتى 8 فريمات موزعة على الفيديو (توفير للحصة)
      const step = Math.max(1, Math.ceil(state.frames.length / 8));
      state.analysis = []; let html = '';
      for (let i = 0; i < state.frames.length; i += step) {
        out.textContent = `بحلّل الفريم ${i + 1} من ${state.frames.length}…`;
        const d = await describeFrame(i); state.analysis[i] = d;
        html += `<div class="card"><img src="${state.frames[i].url}" alt="" style="width:100%;border-radius:8px">
          <b>فريم ${i + 1}</b><small>اتقال: ${esc(textAt(i)) || '—'}</small>
          <small>ظاهر: ${esc(d.scene)}</small><small>المزاج: ${esc(d.mood)}</small></div>`;
      }
      out.innerHTML = `<p>${state.transcript.length} مقطع منطوق، و${state.analysis.filter(Boolean).length} فريم متحلّل.</p><div class="cards">${html}</div>`;
    } catch (e) {
      console.error(e);
      const m = String(e.message || e);
      toast(m === 'login' ? 'سجّل دخولك من تبويب "مشاريعي" الأول.'
        : m.includes('audio-too-long') ? 'الصوت طويل جداً، اقطع نطاق أقصر.'
        : m.includes('GEMINI_API_KEY') ? 'مفتاح Gemini مش متضبط في Supabase Secrets.'
        : m.includes('429') ? 'وصلت لحد الاستخدام اليومي، جرّب بعدين.'
        : 'تعذّر الاتصال بالذكاء الاصطناعي.');
      out.textContent = 'فشل التحليل.';
    } finally { btn.disabled = false; }
  };
}

// Supabase: دخول + مشاريع. (الـ publishable/anon key آمن للواجهة — الحماية بـ RLS)
const SUPABASE_URL = 'https://dbzqejwsivgndftfnezb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JtpQxfx0h2GkUm6xoGEUNw_bQKopifH';
const TABLE = 'framestudio_projects', BUCKET = 'framestudio-frames';
import { state, $, toast, esc } from './state.js';
let client = null;
export function sb() {
  if (!client) {
    if (!window.supabase) throw new Error('supabase-js not loaded');
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}
const loadLib = () => new Promise((ok) => {
  const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  s.onload = ok; s.onerror = ok; document.head.appendChild(s);
});
async function refreshUI() {
  const { data: { session } } = await sb().auth.getSession();
  $('#auth-box').hidden = !!session; $('#user-box').hidden = !session;
  $('#user-mail').textContent = session?.user.email || '';
  if (session) listProjects(); else $('#proj-list').innerHTML = '';
}
export async function initProjects() {
  await loadLib();
  if (!window.supabase) { $('#proj-list').innerHTML = '<p class="hint">تعذّر تحميل Supabase. اتأكد من الإنترنت.</p>'; return; }
  $('#login').onclick = async () => {
    try {
      const email = $('#em').value.trim(), password = $('#pw').value;
      if (!email || password.length < 6) return toast('اكتب الإيميل وكلمة سر 6 حروف على الأقل.');
      let { error } = await sb().auth.signInWithPassword({ email, password });
      if (error && /invalid login/i.test(error.message)) {
        const r = await sb().auth.signUp({ email, password });
        if (r.error) throw r.error;
        if (!r.data.session) return toast('اتبعتلك إيميل تأكيد. أكّد الحساب وبعدين ادخل تاني.');
        error = null;
      }
      if (error) throw error; toast('تم الدخول.'); refreshUI();
    } catch (e) { console.error(e); toast('تعذّر تسجيل الدخول. راجع الإيميل وكلمة السر.'); }
  };
  $('#logout').onclick = async () => { await sb().auth.signOut(); refreshUI(); };
  $('#save-proj').onclick = async () => {
    if (!state.frames.length) return toast('مفيش فريمات تتحفظ. استخرج فريمات الأول.');
    try { await saveProject($('#proj-name').value.trim() || state.name || 'مشروع بدون اسم'); toast('اتحفظ المشروع.'); listProjects(); }
    catch (e) { console.error(e); toast('تعذّر الحفظ. اتأكد إنك مسجّل دخول وإن الجدول متعمل (SETUP.md).'); }
  };
  $('#proj-list').onclick = async (e) => {
    const id = e.target.dataset?.load || e.target.dataset?.del; if (!id) return;
    if (e.target.dataset.del) { if (!confirm('تمسح المشروع ده؟')) return; await deleteProject(id); return listProjects(); }
    const { data, error } = await sb().from(TABLE).select('*').eq('id', id).single();
    if (error) return toast('تعذّر فتح المشروع.');
    Object.assign(state, { fps: data.meta.fps || state.fps }); state.layers = data.meta.layers || {};
    state.transcript = data.meta.transcript || []; state.analysis = data.meta.analysis || [];
    toast(`اتحمّلت تعديلات "${data.name}". ارفع نفس الفيديو واستخرجه بنفس الإعدادات عشان تظهر.`);
  };
  sb().auth.onAuthStateChange(() => refreshUI()); refreshUI();
}
export async function listProjects() {
  const { data, error } = await sb().from(TABLE).select('id,name,updated_at,meta').order('updated_at', { ascending: false });
  if (error) { $('#proj-list').innerHTML = '<p class="hint">تعذّر تحميل المشاريع.</p>'; return; }
  const thumbs = await Promise.all((data || []).map(p => p.meta?.thumb ? sb().storage.from(BUCKET).createSignedUrl(p.meta.thumb, 3600).then(r => r.data?.signedUrl) : null));
  $('#proj-list').innerHTML = (data || []).map((p, i) => `<div class="card">${thumbs[i] ? `<img src="${esc(thumbs[i])}" alt="" style="width:100%;border-radius:8px">` : ''}
    <b>${esc(p.name)}</b><small>${new Date(p.updated_at).toLocaleDateString('ar-EG')} — ${p.meta?.frameCount || 0} فريم</small>
    <div class="row"><button class="mini" data-load="${p.id}">فتح التعديلات</button><button class="mini" data-del="${p.id}">حذف</button></div></div>`).join('')
    || '<p class="hint">مفيش مشاريع لسه.</p>';
}
// حفظ مشروع: البيانات في الجدول + صورة مصغّرة (أول فريم) في bucket "frames"
export async function saveProject(name) {
  const { data: { user } } = await sb().auth.getUser();
  if (!user) throw new Error('login');
  const meta = { fps: state.fps, from: state.from, to: state.to, frameCount: state.frames.length, source: state.name,
    layers: state.layers, transcript: state.transcript, analysis: state.analysis.map(a => a || null) };
  const { data, error } = await sb().from(TABLE).insert({ name, user_id: user.id, meta }).select('id').single();
  if (error) throw error;
  const path = `${user.id}/${data.id}/thumb.jpg`;
  const up = await sb().storage.from(BUCKET).upload(path, state.frames[0].blob, { contentType: 'image/jpeg', upsert: true });
  if (!up.error) await sb().from(TABLE).update({ meta: { ...meta, thumb: path } }).eq('id', data.id);
}
async function deleteProject(id) {
  const { data: { user } } = await sb().auth.getUser();
  await sb().storage.from(BUCKET).remove([`${user.id}/${id}/thumb.jpg`]);
  await sb().from(TABLE).delete().eq('id', id);
}

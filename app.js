// نقطة البداية: التنقل بين المراحل وربط الوحدات
import { initUpload } from './js/upload.js';
import { initExtract } from './js/extract.js';
import { initEditor } from './js/editor.js';
import { initExport } from './js/export.js';
import { initAI } from './js/ai.js';
import { initProjects } from './js/supabase.js';

const STEPS = [...document.querySelectorAll('#steps button')].map(b => b.dataset.step);
function goto(step) {
  if (!STEPS.includes(step)) step = 'upload';
  document.querySelectorAll('.step').forEach(s => s.classList.toggle('on', s.id === 's-' + step));
  document.querySelectorAll('#steps button').forEach(b => b.classList.toggle('on', b.dataset.step === step));
  if (location.hash.slice(1) !== step) history.replaceState(null, '', '#' + step);
  document.dispatchEvent(new CustomEvent('step', { detail: step }));
}
document.querySelectorAll('#steps button').forEach(b => b.onclick = () => goto(b.dataset.step));
initUpload(goto); initExtract(); initEditor(); initExport(); initAI(); initProjects();
goto(location.hash.slice(1));
// تحذير قبل إغلاق الصفحة لو فيه شغل مش متحفوظ
addEventListener('beforeunload', (e) => { if (document.querySelector('#strip')?.children.length) { e.preventDefault(); e.returnValue = ''; } });

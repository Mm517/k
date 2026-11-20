// المرحلة ١: رفع الفيديو والإعدادات
import { state, $, toast, clearFrames } from './state.js';
const MAX_MB = 100;
export function initUpload(goto) {
  const drop = $('#drop'), input = $('#file'), video = $('#preview');
  const range = () => {
    const from = Math.max(0, +$('#t-from').value || 0);
    const to = Math.min(state.duration, +$('#t-to').value || state.duration);
    return { from, to };
  };
  const est = () => {
    const { from, to } = range();
    const n = Math.max(0, Math.round((to - from) * state.fps));
    $('#estimate').textContent = to <= from ? 'المدة غير صحيحة: "إلى" لازم تكون أكبر من "من".'
      : `هيطلع حوالي ${n} فريم` + (n > 600 ? ' — كتير، قلّل الـ FPS أو المدة' : '');
    $('#go-extract').disabled = to <= from;
  };
  const take = (file) => {
    const okType = file && (/^video\//.test(file.type) || /\.(mp4|webm|mov|m4v)$/i.test(file.name));
    if (!okType) return toast('الملف لازم يكون فيديو (mp4 أو webm أو mov).');
    if (file.size > MAX_MB * 1048576) toast(`الملف أكبر من ${MAX_MB} ميجا، ممكن يبطّأ المتصفح أو يفصل.`);
    if (video.src) URL.revokeObjectURL(video.src);
    clearFrames(); state.file = file; state.name = file.name.replace(/\.[^.]+$/, '');
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      state.duration = video.duration; $('#t-from').value = 0; $('#t-to').value = video.duration.toFixed(1); est();
      $('#upload-panel').hidden = false;
    };
    video.onerror = () => toast('المتصفح مش قادر يقرأ الفيديو ده. جرّب mp4 (H.264).');
  };
  input.onchange = () => take(input.files[0]);
  ['dragover', 'dragenter'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(e => drop.addEventListener(e, () => drop.classList.remove('over')));
  drop.addEventListener('drop', ev => { ev.preventDefault(); take(ev.dataTransfer.files[0]); });
  drop.addEventListener('keydown', e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.click()));
  $('#fps').oninput = (e) => { state.fps = +e.target.value; $('#fps-v').textContent = state.fps; est(); };
  $('#t-from').oninput = $('#t-to').oninput = est;
  $('#go-extract').onclick = () => {
    const { from, to } = range(); state.from = from; state.to = to;
    goto('frames'); document.dispatchEvent(new Event('extract'));
  };
}

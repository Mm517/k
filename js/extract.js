// المرحلة ٢: استخراج الفريمات والصوت بـ ffmpeg.wasm
import { state, $, toast, setBar, clearFrames } from './state.js';
import { getFFmpeg, fetchFile, run } from './ffmpeg.js';

let io = null;
export function initExtract() { document.addEventListener('extract', go); }
async function go() {
  const st = $('#status-extract'), btn = $('#go-extract'); btn.disabled = true; setBar('#bar-extract', 0);
  let ff = null;
  try {
    st.textContent = 'بحمّل ffmpeg (أول مرة بياخد شوية)…';
    ff = await getFFmpeg((p) => setBar('#bar-extract', p));
    clearFrames(); $('#strip').innerHTML = ''; $('#big').hidden = true;
    const { from, to } = state, H = +$('#max-h').value || 720, dur = String(Math.max(0.1, to - from));
    await ff.writeFile('in', await fetchFile(state.file));
    st.textContent = 'بقطّع الفيديو لفريمات…';
    // -t بدل -to: أدق مع -ss قبل -i
    await run(ff, ['-ss', String(from), '-t', dur, '-i', 'in', '-vf', `fps=${state.fps},scale=-2:'min(${H},ih)'`, '-q:v', '3', 'f_%05d.jpg']);
    // فصل الصوت (ممكن الفيديو يكون من غير صوت)
    try {
      await run(ff, ['-ss', String(from), '-t', dur, '-i', 'in', '-vn', '-ac', '1', '-ar', '16000', 'audio.wav']);
      state.audio = await ff.readFile('audio.wav'); await ff.deleteFile('audio.wav');
    } catch { state.audio = null; }
    await ff.deleteFile('in');
    const files = (await ff.listDir('/')).filter(f => /^f_\d+\.jpg$/.test(f.name)).map(f => f.name).sort();
    if (!files.length) throw new Error('no frames');
    for (const name of files) {
      const blob = new Blob([await ff.readFile(name)], { type: 'image/jpeg' });
      state.frames.push({ name, blob, url: URL.createObjectURL(blob) });
      await ff.deleteFile(name);
    }
    renderStrip(); setBar('#bar-extract', 1);
    $('#ex-fps').value = state.fps;
    st.textContent = `تم: ${state.frames.length} فريم` + (state.audio ? ' + الصوت.' : ' (الفيديو من غير صوت).');
    document.dispatchEvent(new Event('frames-ready'));
  } catch (e) {
    console.error(e); st.textContent = 'فشل الاستخراج.';
    toast('تعذّر استخراج الفريمات. جرّب ملف أصغر أو FPS أقل، وتأكد إنك فاتح الموقع من سيرفر (مش file://).');
    try { for (const f of await ff?.listDir('/') || []) if (/^(in|audio\.wav|f_\d+\.jpg)$/.test(f.name)) await ff.deleteFile(f.name); } catch { /* تجاهل */ }
  } finally { btn.disabled = false; }
}
function renderStrip() {
  const strip = $('#strip'), big = $('#big');
  io?.disconnect();
  io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.src = e.target.dataset.src; io.unobserve(e.target); } }), { root: strip, rootMargin: '300px' });
  const pick = (im, f) => { strip.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); im.classList.add('sel'); big.src = f.url; big.hidden = false; };
  state.frames.forEach((f, i) => {
    const im = new Image(); im.dataset.src = f.url; im.alt = `فريم ${i + 1}`; im.title = `فريم ${i + 1}`;
    im.onclick = () => pick(im, f);
    strip.appendChild(im); io.observe(im);
  });
  pick(strip.firstChild, state.frames[0]);
}

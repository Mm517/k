// المرحلة ٥: رسم الفريمات على Canvas وتجميعها مع الصوت
import { state, $, toast, setBar, loadFont } from './state.js';
import { getFFmpeg, run } from './ffmpeg.js';
import { drawLayers } from './editor.js';

const pad = (i) => `o_${String(i).padStart(5, '0')}.jpg`;
export function initExport() { $('#go-export').onclick = go; document.addEventListener('frames-ready', () => ($('#ex-fps').value = state.fps)); }
async function go() {
  if (!state.frames.length) return toast('مفيش فريمات. ارفع فيديو واستخرجها الأول.');
  const btn = $('#go-export'), st = $('#status-export'); btn.disabled = true; setBar('#bar-export', 0);
  let ff = null, written = 0, wroteAudio = false;
  try {
    const H = +$('#ex-res').value, fps = +$('#ex-fps').value || state.fps, crf = $('#ex-crf').value;
    st.textContent = 'بحمّل ffmpeg…';
    ff = await getFFmpeg((p) => setBar('#bar-export', 0.5 + p / 2));
    await loadFont(Object.values(state.layers).flat().map(l => l.text || '').join(' ') || 'أ');
    const probe = await createImageBitmap(state.frames[0].blob);
    const h = Math.min(H, probe.height), w = Math.round(probe.width * h / probe.height / 2) * 2; probe.close();
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d');
    for (let i = 0; i < state.frames.length; i++) {
      const bmp = await createImageBitmap(state.frames[i].blob);
      ctx.drawImage(bmp, 0, 0, w, h); bmp.close();
      drawLayers(ctx, state.layers[i], w, h);
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
      await ff.writeFile(pad(i + 1), new Uint8Array(await blob.arrayBuffer())); written++;
      setBar('#bar-export', (i / state.frames.length) * 0.5);
      st.textContent = `بجهّز الفريم ${i + 1} من ${state.frames.length}`;
    }
    const useAudio = $('#ex-audio').checked && !!state.audio?.length;
    // slice(): writeFile بينقل الـ buffer للـ worker فبيفضي الأصل — لازم نبعت نسخة
    if (useAudio) { await ff.writeFile('a.wav', state.audio.slice()); wroteAudio = true; }
    st.textContent = 'بجمّع الفيديو…';
    await run(ff, ['-framerate', String(fps), '-i', 'o_%05d.jpg', ...(useAudio ? ['-i', 'a.wav'] : []),
      '-c:v', 'libx264', '-crf', crf, '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      ...(useAudio ? ['-c:a', 'aac', '-shortest'] : []), '-y', 'out.mp4']);
    const data = await ff.readFile('out.mp4');
    const out = $('#out'); if (out.src) URL.revokeObjectURL(out.src);
    const url = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
    out.src = url; out.hidden = false; $('#dl').href = url; $('#dl').download = `${state.name || 'framestudio'}.mp4`; $('#dl').hidden = false;
    setBar('#bar-export', 1); st.textContent = 'الفيديو جاهز.';
  } catch (e) { console.error(e); st.textContent = 'فشل التجميع.'; toast('تعذّر تجميع الفيديو. قلّل الدقة أو عدد الفريمات وحاول تاني.'); }
  finally {
    // تنظيف الذاكرة في كل الأحوال
    if (ff) { for (let i = 1; i <= written; i++) await ff.deleteFile(pad(i)).catch(() => {});
      await ff.deleteFile('out.mp4').catch(() => {}); if (wroteAudio) await ff.deleteFile('a.wav').catch(() => {}); }
    btn.disabled = false;
  }
}

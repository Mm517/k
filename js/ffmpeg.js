// تحميل ffmpeg.wasm مرة واحدة (نسخة single-thread، مش محتاجة headers خاصة)
const CDN = 'https://cdn.jsdelivr.net/npm';
let ff = null, loading = null, handler = null;
function loadScript(src) {
  return new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok;
    s.onerror = () => no(new Error('تعذّر تحميل ' + src)); document.head.appendChild(s);
  });
}
async function boot() {
  await loadScript(`${CDN}/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js`);
  await loadScript(`${CDN}/@ffmpeg/util@0.12.1/dist/umd/index.js`);
  const { FFmpeg } = window.FFmpegWASM;           // الاسم الصحيح للـ global في النسخة UMD
  const { toBlobURL } = window.FFmpegUtil;
  const inst = new FFmpeg();
  await inst.load({
    coreURL: await toBlobURL(`${CDN}/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${CDN}/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm`, 'application/wasm'),
    classWorkerURL: await toBlobURL(`${CDN}/@ffmpeg/ffmpeg@0.12.10/dist/umd/814.ffmpeg.js`, 'text/javascript'),
  });
  return inst;
}
export async function getFFmpeg(onProgress) {
  loading ||= boot().catch(e => { loading = null; throw e; });
  ff = await loading;
  if (handler) ff.off('progress', handler);       // off لازم ياخد نفس الدالة وإلا المستمعين بيتراكموا
  handler = onProgress ? ({ progress }) => onProgress(Math.min(Math.max(progress, 0), 1)) : null;
  if (handler) ff.on('progress', handler);
  return ff;
}
export const fetchFile = (f) => window.FFmpegUtil.fetchFile(f);
// exec بيرجّع كود الخروج ومش بيرمي خطأ — نحوّله لخطأ
export async function run(ffm, args) {
  const code = await ffm.exec(args);
  if (code !== 0) throw new Error('ffmpeg exit ' + code);
}

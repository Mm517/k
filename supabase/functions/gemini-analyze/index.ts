// FrameStudio: Gemini proxy — المفاتيح في Secrets (GEMINI_API_KEYS مفصولة بفاصلة، أو GEMINI_API_KEY لمفتاح واحد)
const MODEL = "gemini-2.5-flash";
const MAX_BODY = 24_000_000;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// مستخدم مسجّل فعلاً مش مجرد anon key (التوقيع اتتحقق منه verify_jwt)
function isUser(req: Request) {
  try {
    const t = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "").split(".")[1];
    const p = JSON.parse(atob(t.replace(/-/g, "+").replace(/_/g, "/")));
    return p.role === "authenticated" && !!p.sub;
  } catch { return false; }
}

const PROMPTS: Record<string, string> = {
  transcribe:
    'فرّغ الكلام في الصوت (عربي مصري أو إنجليزي) بتوقيتات. رجّع JSON فقط بالشكل {"segments":[{"start":ثواني,"end":ثواني,"text":"..."}]}. لو مفيش كلام رجّع segments فاضية.',
  describe:
    'حلّل الصورة (فريم من فيديو). رجّع JSON فقط بالشكل {"scene":"وصف المشهد بالعربي","objects":["..."],"text":"النص الظاهر أو فاضي","mood":"المزاج العام"}.',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!isUser(req)) return json({ error: "login required" }, 401);
  try {
    const keys = (Deno.env.get("GEMINI_API_KEYS") || Deno.env.get("GEMINI_API_KEY") || "")
      .split(",").map((k) => k.trim()).filter(Boolean);
    if (!keys.length) return json({ error: "GEMINI_API_KEY secret is not set" }, 500);
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return json({ error: "too large" }, 413);
    const { task, audio, image } = await req.json();
    const prompt = PROMPTS[task];
    if (!prompt) return json({ error: "bad task" }, 400);
    const media = task === "transcribe"
      ? { inline_data: { mime_type: "audio/wav", data: audio } }
      : { inline_data: { mime_type: "image/jpeg", data: image } };
    if (!media.inline_data.data) return json({ error: "missing media" }, 400);
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }, media] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    });
    // نبدأ من مفتاح عشوائي لتوزيع الحمل، ولو المفتاح وصل للحد (429) أو مرفوض (403) نجرّب اللي بعده
    const start = Math.floor(Math.random() * keys.length);
    let up: Response | null = null;
    for (let n = 0; n < keys.length; n++) {
      up = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": keys[(start + n) % keys.length] },
          body,
          signal: AbortSignal.timeout(90_000),
        },
      );
      if (up.status !== 429 && up.status !== 403) break;
    }
    if (!up!.ok) return json({ error: "upstream " + up!.status }, up!.status === 429 ? 429 : 502);
    const data = await up!.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return json(JSON.parse(text));
  } catch (e) {
    return json({ error: String((e as Error).message) }, 400);
  }
});

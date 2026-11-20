# إعداد فريم ستوديو (خطوة بخطوة)

## هيكل المشروع
```
index.html  style.css  app.js
js/  state.js ffmpeg.js upload.js extract.js editor.js export.js ai.js supabase.js
supabase/functions/gemini-analyze/index.ts
```

## التشغيل المحلي
`npx serve .` ثم افتح الرابط (ffmpeg.wasm مش بيشتغل من file://). محتاج إنترنت لتحميل ffmpeg و supabase-js من CDN.

## Supabase
1. اعمل مشروع في supabase.com، وحط Project URL و anon/publishable key في `js/supabase.js`.
2. من SQL Editor شغّل:
```sql
create table if not exists framestudio_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  name text not null, meta jsonb default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table framestudio_projects enable row level security;
create policy "own projects" on framestudio_projects for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- bucket خاص للصور المصغّرة + سياسات: كل مستخدم في مجلد باسم الـ id بتاعه
insert into storage.buckets (id, name, public) values ('framestudio-frames', 'framestudio-frames', false) on conflict do nothing;
create policy "framestudio frames read"   on storage.objects for select to authenticated
  using (bucket_id = 'framestudio-frames' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "framestudio frames insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'framestudio-frames' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "framestudio frames update" on storage.objects for update to authenticated
  using (bucket_id = 'framestudio-frames' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "framestudio frames delete" on storage.objects for delete to authenticated
  using (bucket_id = 'framestudio-frames' and (storage.foldername(name))[1] = auth.uid()::text);
```
3. Authentication → Providers: فعّل Email (لو مفعّل Confirm email، أكّد الإيميل بعد التسجيل).
4. المفاتيح: Edge Functions → Secrets → أضف `GEMINI_API_KEYS` (أكتر من مفتاح مفصولين بفاصلة، بيتبدّلوا تلقائياً لو واحد وصل للحد) أو `GEMINI_API_KEY` لمفتاح واحد.
5. النشر: `supabase functions deploy gemini-analyze` (الكود جاهز في `supabase/functions/gemini-analyze/index.ts`).

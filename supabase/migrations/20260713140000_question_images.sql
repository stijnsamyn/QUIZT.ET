-- Één afbeelding per vraag
--
-- 1) Kolom op questions.
alter table public.questions
  add column if not exists image_url text;

-- 2) Publieke storage-bucket voor vraag-afbeeldingen.
--    Lezen: iedereen (publieke URL's).
--    Schrijven: enkel beheerders/admins (op basis van profiles.role).
insert into storage.buckets (id, name, public)
  values ('question-images','question-images', true)
  on conflict (id) do update set public = true;

-- Kleine helper — is de huidige auth-user een beheerder of admin?
create or replace function public.is_quiz_editor()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role in ('beheerder','admin')
       from public.profiles
      where id = auth.uid()),
    false)
$$;

-- Policies op storage.objects, gescoped op onze bucket.
-- We droppen eerst voorgaande varianten (idempotent) zodat re-runs werken.
drop policy if exists "question-images public read"   on storage.objects;
drop policy if exists "question-images editor write"  on storage.objects;
drop policy if exists "question-images editor update" on storage.objects;
drop policy if exists "question-images editor delete" on storage.objects;

create policy "question-images public read"
  on storage.objects for select
  using (bucket_id = 'question-images');

create policy "question-images editor write"
  on storage.objects for insert
  with check (bucket_id = 'question-images' and public.is_quiz_editor());

create policy "question-images editor update"
  on storage.objects for update
  using      (bucket_id = 'question-images' and public.is_quiz_editor())
  with check (bucket_id = 'question-images' and public.is_quiz_editor());

create policy "question-images editor delete"
  on storage.objects for delete
  using (bucket_id = 'question-images' and public.is_quiz_editor());

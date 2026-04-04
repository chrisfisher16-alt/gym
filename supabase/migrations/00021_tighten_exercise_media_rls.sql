-- =============================================================================
-- 00021_tighten_exercise_media_rls.sql
-- Restrict exercise-media bucket writes to service_role only.
-- Regular users should only read curated exercise assets.
-- =============================================================================

-- Drop overly permissive write policies
drop policy if exists "Authenticated users can upload exercise media" on storage.objects;
drop policy if exists "Authenticated users can update exercise media" on storage.objects;
drop policy if exists "Authenticated users can delete exercise media" on storage.objects;

-- Re-create write policies restricted to service_role
create policy "Service role can upload exercise media"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'exercise-media');

create policy "Service role can update exercise media"
  on storage.objects for update
  to service_role
  using (bucket_id = 'exercise-media');

create policy "Service role can delete exercise media"
  on storage.objects for delete
  to service_role
  using (bucket_id = 'exercise-media');

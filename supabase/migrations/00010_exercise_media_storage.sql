-- =============================================================================
-- 00010_exercise_media_storage.sql
-- Create storage bucket for exercise media (thumbnails, hero images)
-- =============================================================================

-- Create the exercise-media storage bucket with public access
insert into storage.buckets (id, name, public)
values ('exercise-media', 'exercise-media', true)
on conflict (id) do nothing;

-- Allow public (anon) read access to all objects in the bucket
create policy "Public read access for exercise media"
  on storage.objects for select
  using (bucket_id = 'exercise-media');

-- Allow authenticated users to upload/update objects (admin use)
create policy "Authenticated users can upload exercise media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'exercise-media');

-- Allow authenticated users to update existing objects
create policy "Authenticated users can update exercise media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'exercise-media');

-- Allow authenticated users to delete objects
create policy "Authenticated users can delete exercise media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'exercise-media');

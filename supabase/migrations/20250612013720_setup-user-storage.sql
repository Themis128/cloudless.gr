-- Do NOT enable RLS here — it's already enabled on storage.objects

-- Allow INSERT only if user is uploading to their own folder
create policy "Users can upload their own files"
on storage.objects
for insert
to authenticated
with check (
  auth.uid() = split_part(name, '/', 1)::uuid
);

-- Allow SELECT only if user is accessing their own files
create policy "Users can read their own files"
on storage.objects
for select
to authenticated
using (
  auth.uid() = split_part(name, '/', 1)::uuid
);

-- Allow DELETE only if user is deleting their own files
create policy "Users can delete their own files"
on storage.objects
for delete
to authenticated
using (
  auth.uid() = split_part(name, '/', 1)::uuid
);

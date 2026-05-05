-- Create ticket-attachments storage bucket and policies
-- Run this in your Supabase SQL Editor

-- Create the bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', true)
on conflict (id) do nothing;

-- Policy: allow authenticated users to upload files
-- Only call_center_admins creating tickets should be uploading
create policy "Allow authenticated uploads"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'ticket-attachments');

-- Policy: allow authenticated users to read files
create policy "Allow authenticated reads"
on storage.objects
for select
to authenticated
using (bucket_id = 'ticket-attachments');

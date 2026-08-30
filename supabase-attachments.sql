-- Run this once in the Supabase SQL Editor.
-- The app uses custom login records rather than Supabase Auth, so the anon role
-- must be allowed for the current browser upload flow.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
    'ticket-attachments',
    'ticket-attachments',
    false,
    10485760,
    array[
        'image/*',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
    ]::text[]
where not exists (
    select 1 from storage.buckets where id = 'ticket-attachments'
);

create table if not exists public.ticket_attachments (
    id uuid primary key default gen_random_uuid(),
    ticket_no bigint not null,
    storage_path text not null unique,
    original_name text not null,
    content_type text,
    file_size bigint not null,
    uploaded_at timestamptz not null default now()
);

alter table public.ticket_attachments enable row level security;

drop policy if exists "Allow ticket attachment metadata inserts" on public.ticket_attachments;
create policy "Allow ticket attachment metadata inserts"
on public.ticket_attachments for insert
to anon, authenticated
with check (file_size > 0 and file_size <= 10485760);

drop policy if exists "Allow ticket attachment metadata reads" on public.ticket_attachments;
create policy "Allow ticket attachment metadata reads"
on public.ticket_attachments for select
to anon, authenticated
using (true);

drop policy if exists "Allow ticket attachment uploads" on storage.objects;
create policy "Allow ticket attachment uploads"
on storage.objects for insert
to anon, authenticated
with check (
    bucket_id = 'ticket-attachments'
    and (storage.foldername(name))[1] <> ''
);

drop policy if exists "Allow ticket attachment reads" on storage.objects;
create policy "Allow ticket attachment reads"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'ticket-attachments');

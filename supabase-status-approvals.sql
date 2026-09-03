-- Run once in the Supabase SQL Editor.
-- The app uses custom login records, so these policies follow the existing anon browser flow.

create table if not exists public.status_change_requests (
    id uuid primary key default gen_random_uuid(),
    ticket_no bigint not null,
    previous_status text not null,
    requested_status text not null check (requested_status in ('PENDING', 'RESOLVED', 'BLOCKED')),
    requested_by text not null,
    request_status text not null default 'PENDING' check (request_status in ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by text,
    created_at timestamptz not null default now(),
    reviewed_at timestamptz
);

alter table public.status_change_requests enable row level security;

drop policy if exists "Allow status approval requests" on public.status_change_requests;
create policy "Allow status approval requests"
on public.status_change_requests for all
to anon, authenticated
using (true)
with check (true);

create index if not exists status_change_requests_pending_idx
on public.status_change_requests (request_status, created_at desc);

create unique index if not exists one_pending_status_request_per_ticket
on public.status_change_requests (ticket_no)
where request_status = 'PENDING';

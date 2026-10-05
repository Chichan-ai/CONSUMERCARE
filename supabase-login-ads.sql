-- Run once in the Supabase SQL Editor.
-- Manage login ads in Supabase Dashboard > Table Editor > public.login_ads.
-- Add image URLs, alt text, optional links, display order, and active state there.
-- The browser app has a public anon key and custom client-side login, so writes
-- are intentionally restricted to the Supabase backend (service role).

create table if not exists public.login_ads (
    id uuid primary key default gen_random_uuid(),
    image_url text not null unique check (image_url ~* '^https?://'),
    alt_text text not null default 'Agribank announcement',
    link_url text check (link_url is null or link_url ~* '^https?://'),
    sort_order integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.login_ads enable row level security;

revoke all on public.login_ads from anon, authenticated;
grant select on public.login_ads to anon, authenticated;

drop policy if exists "Public can read active login ads" on public.login_ads;
create policy "Public can read active login ads"
on public.login_ads for select
to anon, authenticated
using (is_active = true);

insert into public.login_ads (image_url, alt_text, sort_order)
values
    ('https://chichan-ai.github.io/CBAMS2.0/assets/Untitled%20design%20(10).png', 'Agribank announcement 1', 1),
    ('https://chichan-ai.github.io/CBAMS2.0/assets/ChatGPT%20Image%20Jul%2023,%202026,%2005_33_12%20PM.png', 'Agribank announcement 2', 2),
    ('https://chichan-ai.github.io/CBAMS2.0/assets/ChatGPT%20Image%20Jul%2023,%202026,%2005_24_35%20PM.png', 'Agribank announcement 3', 3)
on conflict (image_url) do nothing;
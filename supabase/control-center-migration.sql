-- AvastFall TCG Control Center migration
-- Safe to run repeatedly. Uses existing app_meta table; no destructive operations.
insert into public.app_meta (key, value)
values ('system_control_v1', '{"maintenance":{"game":false,"matchmaking":false,"shop":false,"cards":false,"global":false},"messages":{}}'::jsonb)
on conflict (key) do nothing;

-- Announcements with scheduling and expiry; kept separate from legacy Update Notes.
create table if not exists public.system_announcements (
  id text primary key,
  title text not null,
  body text not null,
  kind text not null default 'news' check (kind in ('news','patch','warning','maintenance','emergency')),
  status text not null default 'draft' check (status in ('draft','scheduled','published','expired')),
  publish_at timestamptz,
  expires_at timestamptz,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists system_announcements_publish_idx on public.system_announcements(status, publish_at desc);
alter table public.system_announcements enable row level security;
grant all on public.system_announcements to service_role;
notify pgrst, 'reload schema';

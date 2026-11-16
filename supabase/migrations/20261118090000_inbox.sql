create type public.capture_kind as enum ('idea', 'expense', 'income', 'task', 'link', 'goal', 'investment');

create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  context public.context_kind not null default 'personal',
  kind public.capture_kind not null default 'idea',
  raw_text text not null check (length(btrim(raw_text)) between 1 and 500),
  url text check (url is null or (length(url) <= 500 and url ~* '^https?://')),
  payload jsonb not null default '{}'::jsonb,
  routed_table text check (routed_table is null or routed_table in ('expenses', 'incomes', 'tasks', 'courses', 'goals', 'investment_transactions')),
  routed_id uuid,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((routed_table is null) = (routed_id is null))
);

create index inbox_pending_idx on public.inbox_items (user_id, created_at desc) where processed_at is null;

select private.secure_table('public.inbox_items', false);

grant select, insert, update, delete on public.inbox_items to authenticated;

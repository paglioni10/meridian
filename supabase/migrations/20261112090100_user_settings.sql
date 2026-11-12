create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  active_context text not null default 'all' check (active_context in ('all', 'personal', 'work', 'freelance')),
  obsidian_vault text check (obsidian_vault is null or length(obsidian_vault) between 1 and 120),
  safe_base_months smallint not null default 6 check (safe_base_months between 3 and 24),
  timezone text not null default 'America/Sao_Paulo',
  updated_at timestamptz not null default now()
);

select private.secure_table('public.user_settings');

grant select, insert, update on public.user_settings to authenticated;

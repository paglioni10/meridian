create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.context_kind as enum ('personal', 'work', 'freelance');
create type public.priority_level as enum ('low', 'medium', 'high', 'critical');

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.secure_table(p_table regclass, p_with_updated_at boolean default true)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_name text := (select relname from pg_catalog.pg_class where oid = p_table);
begin
  execute format('alter table %s enable row level security', p_table);
  execute format('alter table %s force row level security', p_table);
  execute format(
    'create policy %I on %s for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
    v_name || '_owner_all',
    p_table
  );
  if p_with_updated_at then
    execute format(
      'create trigger %I before update on %s for each row execute function private.set_updated_at()',
      v_name || '_updated_at',
      p_table
    );
  end if;
end;
$$;

revoke all on function private.secure_table(regclass, boolean) from public, anon, authenticated;

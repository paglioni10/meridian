create type public.reminder_recurrence as enum ('once', 'monthly');

alter type public.alert_kind add value if not exists 'billing_due';

create table public.billing_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  client_id uuid not null,
  deal_id uuid,
  amount_cents bigint check (amount_cents > 0),
  remind_on date not null,
  recurrence public.reminder_recurrence not null default 'once',
  day_of_month smallint check (day_of_month between 1 and 31),
  note text check (note is null or length(note) <= 200),
  done_at timestamptz,
  last_paid_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (recurrence = 'once' or day_of_month is not null),
  foreign key (client_id, user_id) references public.clients (id, user_id) on delete cascade,
  foreign key (deal_id, user_id) references public.deals (id, user_id) on delete set null (deal_id)
);

create index billing_reminders_pending_idx on public.billing_reminders (user_id, remind_on) where done_at is null;

create or replace function private.billing_reminders_sync()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deal_id is not null and not exists (
    select 1 from public.deals d where d.id = new.deal_id and d.client_id = new.client_id
  ) then
    raise exception 'deal belongs to another client' using errcode = '23514';
  end if;
  if new.recurrence = 'monthly' then
    new.day_of_month := coalesce(new.day_of_month, extract(day from new.remind_on)::smallint);
    new.done_at := null;
  else
    new.day_of_month := null;
  end if;
  return new;
end;
$$;

create trigger billing_reminders_sync
  before insert or update on public.billing_reminders
  for each row execute function private.billing_reminders_sync();

alter table public.alert_events add column reminder_id uuid;
alter table public.alert_events
  add constraint alert_events_reminder_fk foreign key (reminder_id, user_id)
  references public.billing_reminders (id, user_id) on delete cascade;

select private.secure_table('public.billing_reminders');

grant select, insert, update, delete on public.billing_reminders to authenticated;

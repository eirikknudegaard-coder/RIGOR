-- No application price data or uploaded rows are stored here.
create table if not exists public.rigor_ai_import_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reserved_at timestamptz not null default now(),
  input_tokens integer,
  output_tokens integer
);
create index if not exists rigor_ai_import_usage_day on public.rigor_ai_import_usage(reserved_at);
alter table public.rigor_ai_import_usage enable row level security;
revoke all on public.rigor_ai_import_usage from anon, authenticated;

-- Serializes reservations so concurrent requests cannot exceed the daily limit.
create or replace function public.reserve_rigor_ai_import(p_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare reservation uuid;
begin
  perform pg_advisory_xact_lock(87134005);
  if (select count(*) from public.rigor_ai_import_usage where reserved_at >= date_trunc('day', now())) >= 100 then
    raise exception 'Daily project import limit reached';
  end if;
  if (select count(*) from public.rigor_ai_import_usage where user_id=p_user_id and reserved_at >= date_trunc('day', now())) >= 20 then
    raise exception 'Daily user import limit reached';
  end if;
  insert into public.rigor_ai_import_usage(user_id) values(p_user_id) returning id into reservation;
  return reservation;
end;
$$;
revoke all on function public.reserve_rigor_ai_import(uuid) from public, anon, authenticated;
grant execute on function public.reserve_rigor_ai_import(uuid) to service_role;

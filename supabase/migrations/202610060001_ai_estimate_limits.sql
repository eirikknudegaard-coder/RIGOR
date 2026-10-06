create table public.rigor_ai_estimate_usage (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 reserved_at timestamptz not null default now(),
 input_tokens integer, output_tokens integer
);
create index on public.rigor_ai_estimate_usage(user_id,reserved_at);
alter table public.rigor_ai_estimate_usage enable row level security;
revoke all on public.rigor_ai_estimate_usage from anon,authenticated;
create or replace function public.reserve_rigor_ai_estimate(p_user_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare reservation uuid;
begin
 perform pg_advisory_xact_lock(87134007);
 if (select count(*) from public.rigor_ai_estimate_usage where user_id=p_user_id and reserved_at>=date_trunc('day',now()))>=10 then raise exception 'Daily user limit reached';end if;
 if (select count(*) from public.rigor_ai_estimate_usage where reserved_at>=date_trunc('day',now()))>=100 then raise exception 'Daily project limit reached';end if;
 if exists(select 1 from public.rigor_ai_estimate_usage where user_id=p_user_id and reserved_at>now()-interval '45 seconds') then raise exception 'Please wait before retrying';end if;
 insert into public.rigor_ai_estimate_usage(user_id) values(p_user_id) returning id into reservation;return reservation;
end;$$;
revoke all on function public.reserve_rigor_ai_estimate(uuid) from public,anon,authenticated;
grant execute on function public.reserve_rigor_ai_estimate(uuid) to service_role;

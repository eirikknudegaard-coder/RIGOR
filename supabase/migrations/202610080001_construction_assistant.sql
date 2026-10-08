-- Registration does not grant anyone access or overwrite a disabled record.
insert into public.portal_tools(tool_key,title,description,enabled)
values ('konstruksjon','RIGOR Konstruksjon','Byggteknisk assistent: lastvei og orienterende beregning av enkle bjelker.',true)
on conflict (tool_key) do nothing;

create table if not exists public.rigor_ai_construction_usage (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 reserved_at timestamptz not null default now(),
 input_tokens integer check(input_tokens>=0), output_tokens integer check(output_tokens>=0)
);
create index if not exists rigor_ai_construction_usage_user_reserved_idx on public.rigor_ai_construction_usage(user_id,reserved_at);
alter table public.rigor_ai_construction_usage enable row level security;
revoke all on public.rigor_ai_construction_usage from public,anon,authenticated;
grant select,insert,update on public.rigor_ai_construction_usage to service_role;
create or replace function public.reserve_rigor_ai_construction(p_user_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare reservation uuid;
begin
 perform pg_advisory_xact_lock(87134008);
 if (select count(*) from public.rigor_ai_construction_usage where user_id=p_user_id and reserved_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=10 then raise exception 'Daily user limit reached';end if;
 if (select count(*) from public.rigor_ai_construction_usage where reserved_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=100 then raise exception 'Daily project limit reached';end if;
 if exists(select 1 from public.rigor_ai_construction_usage where user_id=p_user_id and reserved_at>now()-interval '45 seconds') then raise exception 'Please wait before retrying';end if;
 insert into public.rigor_ai_construction_usage(user_id) values(p_user_id) returning id into reservation;return reservation;
end;$$;
revoke all on function public.reserve_rigor_ai_construction(uuid) from public,anon,authenticated;
grant execute on function public.reserve_rigor_ai_construction(uuid) to service_role;

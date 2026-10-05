create table public.rigor_price_sources (
 chain text primary key check(chain in ('obs','byggmax')),
 enabled boolean not null default false,
 permitted boolean not null default false,
 permission_note text not null default '',
 interval_hours integer not null default 6 check(interval_hours between 6 and 168),
 last_started_at timestamptz
);
insert into public.rigor_price_sources(chain) values('obs'),('byggmax');
create table public.rigor_price_groups (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 1 and 160),
 price_key text not null unique check(price_key ~ '^[a-z][a-z0-9_.-]{1,99}$'),
 kind text not null check(kind in ('timber','decking','gypsum','insulation')),
 unit text not null check(unit in ('m','m2','stk')),
 specs jsonb not null default '{}'::jsonb
);
create table public.rigor_price_products (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.rigor_price_groups(id),
 chain text not null references public.rigor_price_sources(chain),
 source_id text not null check(length(source_id) between 1 and 150),
 name text not null,
 url text not null,
 ean text, nobb text,
 specs jsonb not null default '{}'::jsonb,
 original_unit text not null,
 package_quantity numeric(14,4) not null check(package_quantity>0),
 unit text not null check(unit in ('m','m2','stk')),
 vat text not null check(vat in ('inkl','ekskl')),
 price_kind text not null check(price_kind in ('ordinary','campaign','member')),
 store_id text, area text,
 approved boolean not null default false,
 approval_note text not null default '',
 enabled boolean not null default true,
 last_attempt_at timestamptz, last_success_at timestamptz,
 last_error text,
 unique(chain,source_id),
 check(url ~ '^https://www\.(obsbygg|byggmax)\.no/')
);
create table public.rigor_price_jobs (
 id uuid primary key default gen_random_uuid(),
 started_at timestamptz not null default now(),
 lease_until timestamptz not null default now()+interval '110 seconds',
 finished_at timestamptz,
 status text not null default 'running' check(status in ('running','completed','failed','expired')),
 succeeded integer not null default 0, failed integer not null default 0,
 error text
);
create table public.rigor_price_observations (
 id bigint generated always as identity primary key,
 product_id uuid not null references public.rigor_price_products(id),
 job_id uuid not null references public.rigor_price_jobs(id),
 checked_at timestamptz not null default now(),
 product_snapshot jsonb not null,
 original_ore bigint not null check(original_ore>0),
 normalized_ore bigint not null check(normalized_ore>=0),
 currency text not null default 'NOK' check(currency='NOK'),
 unit text not null,
 conversion text not null,
 availability text not null,
 valid_until date,
 accepted boolean not null,
 flag text,
 unique(product_id,job_id)
);
create index on public.rigor_price_observations(product_id,checked_at desc);
create or replace function public.claim_rigor_price_job() returns uuid language plpgsql security definer set search_path=public as $$
declare job uuid;
begin
 perform pg_advisory_xact_lock(87134006);
 if exists(select 1 from public.rigor_price_jobs where status='running' and lease_until>now()) then return null; end if;
 update public.rigor_price_jobs set status='expired',finished_at=now() where status='running';
 if exists(select 1 from public.rigor_price_jobs where started_at>now()-interval '5 minutes') then return null; end if;
 insert into public.rigor_price_jobs default values returning id into job;return job;
end;$$;
revoke all on function public.claim_rigor_price_job() from public,anon,authenticated;
grant execute on function public.claim_rigor_price_job() to service_role;
-- Service role owns writes. Browser writes go through the authenticated admin function.
alter table public.rigor_price_sources enable row level security;
alter table public.rigor_price_groups enable row level security;
alter table public.rigor_price_products enable row level security;
alter table public.rigor_price_jobs enable row level security;
alter table public.rigor_price_observations enable row level security;
revoke all on public.rigor_price_sources,public.rigor_price_groups,public.rigor_price_products,public.rigor_price_jobs,public.rigor_price_observations from anon,authenticated;

-- Broader assortment with strict type-specific matching. No fake products seeded.
alter table public.rigor_price_groups drop constraint rigor_price_groups_kind_check;
alter table public.rigor_price_groups add constraint rigor_price_groups_kind_check check(kind in ('timber','battens','decking','cladding','gypsum','boards','insulation','membranes','roofing','tape','fasteners','hardware','trim','flooring','windows','doors'));
alter table public.rigor_price_products add column next_check_at timestamptz;
create index on public.rigor_price_products(chain,next_check_at,last_attempt_at) where enabled and approved;
-- Return one current accepted observation per product; history cannot crowd out
-- products that were checked earlier in the same day.
create or replace function public.rigor_current_price_observations()
returns setof public.rigor_price_observations
language sql stable security definer set search_path=public as $$
 select distinct on (product_id) * from public.rigor_price_observations
 where accepted and checked_at>=now()-interval '24 hours'
 order by product_id,checked_at desc;
$$;
revoke all on function public.rigor_current_price_observations() from public,anon,authenticated;
grant execute on function public.rigor_current_price_observations() to service_role;

-- Public /status figures: bucket counts under 5, exclude confidential/harassment/anonymous/safety.

create or replace function public.public_count_label(n bigint)
returns text
language sql
immutable
as $$
  select case
    when n is null or n <= 0 then '0'
    when n < 5 then 'fewer than 5'
    else n::text
  end;
$$;

create or replace function public.public_count_exact(n bigint)
returns bigint
language sql
immutable
as $$
  select case when n is null or n < 5 then null else n end;
$$;

-- Eligible ordinary reports only (same filter as public_reports).
create or replace view public.public_status_by_category
with (security_invoker = false) as
with eligible as (
  select
    r.category,
    r.status,
    r.created_at,
    r.resolved_at
  from public.reports r
  where r.confidential = false
    and r.anonymous = false
    and r.category not in ('harassment', 'safety')
    and r.status not in ('draft', 'rejected')
),
agg as (
  select
    c.id as category_id,
    c.en,
    c.bn,
    count(*) filter (
      where e.status in ('submitted', 'under_review', 'assigned', 'in_progress', 'reopened')
    )::bigint as open_raw,
    count(*) filter (
      where e.status in ('resolved', 'closed')
    )::bigint as resolved_raw,
    avg(
      extract(epoch from (e.resolved_at - e.created_at)) / 3600.0
    ) filter (
      where e.resolved_at is not null
        and e.resolved_at >= (now() - interval '30 days')
        and e.status in ('resolved', 'closed')
    ) as avg_hours_30d
  from public.categories c
  left join eligible e on e.category = c.id
  where c.id not in ('harassment', 'safety')
  group by c.id, c.en, c.bn
)
select
  category_id,
  en,
  bn,
  public.public_count_exact(open_raw) as open_count,
  public.public_count_label(open_raw) as open_label,
  public.public_count_exact(resolved_raw) as resolved_count,
  public.public_count_label(resolved_raw) as resolved_label,
  case
    when avg_hours_30d is null then null
    else round((avg_hours_30d / 24.0)::numeric, 1)
  end as avg_resolution_days_30d
from agg;

create or replace view public.public_status_by_office
with (security_invoker = false) as
with eligible as (
  select
    r.department_id,
    r.status,
    r.created_at,
    r.resolved_at
  from public.reports r
  where r.confidential = false
    and r.anonymous = false
    and r.category not in ('harassment', 'safety')
    and r.status not in ('draft', 'rejected')
    and r.department_id is not null
),
agg as (
  select
    d.id as office_id,
    d.en,
    d.bn,
    count(*) filter (
      where e.status in ('submitted', 'under_review', 'assigned', 'in_progress', 'reopened')
    )::bigint as open_raw,
    count(*) filter (
      where e.status in ('resolved', 'closed')
    )::bigint as resolved_raw,
    avg(
      extract(epoch from (e.resolved_at - e.created_at)) / 3600.0
    ) filter (
      where e.resolved_at is not null
        and e.resolved_at >= (now() - interval '30 days')
        and e.status in ('resolved', 'closed')
    ) as avg_hours_30d
  from public.departments d
  left join eligible e on e.department_id = d.id
  where d.sensitive = false
  group by d.id, d.en, d.bn
)
select
  office_id,
  en,
  bn,
  public.public_count_exact(open_raw) as open_count,
  public.public_count_label(open_raw) as open_label,
  public.public_count_exact(resolved_raw) as resolved_count,
  public.public_count_label(resolved_raw) as resolved_label,
  case
    when avg_hours_30d is null then null
    else round((avg_hours_30d / 24.0)::numeric, 1)
  end as avg_resolution_days_30d
from agg;

create or replace view public.public_status_summary
with (security_invoker = false) as
with eligible as (
  select
    r.status,
    r.created_at,
    r.resolved_at
  from public.reports r
  where r.confidential = false
    and r.anonymous = false
    and r.category not in ('harassment', 'safety')
    and r.status not in ('draft', 'rejected')
),
agg as (
  select
    count(*) filter (
      where status in ('submitted', 'under_review', 'assigned', 'in_progress', 'reopened')
    )::bigint as open_raw,
    count(*) filter (
      where status in ('resolved', 'closed')
    )::bigint as resolved_raw,
    count(*) filter (
      where status in ('resolved', 'closed')
        and resolved_at is not null
        and resolved_at >= (now() - interval '30 days')
    )::bigint as resolved_30d_raw,
    avg(
      extract(epoch from (resolved_at - created_at)) / 3600.0
    ) filter (
      where resolved_at is not null
        and resolved_at >= (now() - interval '30 days')
        and status in ('resolved', 'closed')
    ) as avg_hours_30d
  from eligible
)
select
  public.public_count_exact(open_raw) as open_count,
  public.public_count_label(open_raw) as open_label,
  public.public_count_exact(resolved_raw) as resolved_count,
  public.public_count_label(resolved_raw) as resolved_label,
  public.public_count_exact(resolved_30d_raw) as resolved_30d_count,
  public.public_count_label(resolved_30d_raw) as resolved_30d_label,
  case
    when avg_hours_30d is null then null
    else round((avg_hours_30d / 24.0)::numeric, 1)
  end as avg_resolution_days_30d
from agg;

grant execute on function public.public_count_label(bigint) to anon, authenticated;
grant execute on function public.public_count_exact(bigint) to anon, authenticated;
grant select on public.public_status_by_category to anon, authenticated;
grant select on public.public_status_by_office to anon, authenticated;
grant select on public.public_status_summary to anon, authenticated;

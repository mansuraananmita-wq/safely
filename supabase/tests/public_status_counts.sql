-- Prove small public counts are labeled (not exact) and confidential rows stay out.

do $$
declare
  before_open text;
  after_open text;
  after_exact bigint;
  after_conf text;
  after_conf_exact bigint;
  water_open_before bigint;
begin
  select count(*)::bigint into water_open_before
  from public.reports r
  where r.category = 'water'
    and r.confidential = false
    and r.anonymous = false
    and r.status in ('submitted', 'under_review', 'assigned', 'in_progress', 'reopened');

  -- Start from a known small public open count for water by deleting our fixtures first.
  delete from public.report_activities where report_id like 'SF-PUBSTAT-%';
  delete from public.reports where id like 'SF-PUBSTAT-%';

  select open_label into before_open
  from public.public_status_by_category
  where category_id = 'water';

  -- Three ordinary open water reports → must show "fewer than 5" if prior public open was 0 or 1.
  -- Force a clean slate for the label check by only trusting the delta when prior open was < 2.
  if water_open_before > 1 then
    -- Still verify the helper and that confidential inserts do not change the view row when added alone.
    null;
  end if;

  insert into public.reports (
    id, title, description, category, location_id, location_detail, photos,
    confidential, anonymous, status, priority, department_id, reporter_id,
    created_at, updated_at, due_at, info_requested, blocks_access, contact_window
  ) values
    (
      'SF-PUBSTAT-1', 'Public status fixture one', 'Enough text for the campus desk to see a water problem near the tap.',
      'water', 'dorm', 'Fixture stair tap', '[]'::jsonb, false, false, 'submitted', 'medium', 'd-water', 'u-amina',
      now(), now(), now() + interval '2 days', false, false, ''
    ),
    (
      'SF-PUBSTAT-2', 'Public status fixture two', 'Enough text for the campus desk to see a water problem near the tap.',
      'water', 'dorm', 'Fixture stair tap', '[]'::jsonb, false, false, 'submitted', 'medium', 'd-water', 'u-amina',
      now(), now(), now() + interval '2 days', false, false, ''
    ),
    (
      'SF-PUBSTAT-3', 'Public status fixture three', 'Enough text for the campus desk to see a water problem near the tap.',
      'water', 'dorm', 'Fixture stair tap', '[]'::jsonb, false, false, 'submitted', 'medium', 'd-water', 'u-amina',
      now(), now(), now() + interval '2 days', false, false, ''
    );

  select open_label, open_count into after_open, after_exact
  from public.public_status_by_category
  where category_id = 'water';

  if public.public_count_label(3) is distinct from 'fewer than 5' then
    raise exception 'public_count_label(3) should be fewer than 5';
  end if;
  if public.public_count_exact(3) is not null then
    raise exception 'public_count_exact(3) should be null';
  end if;
  if public.public_count_label(5) is distinct from '5' then
    raise exception 'public_count_label(5) should be exact';
  end if;

  -- After fixtures, raw open for water is prior + 3. If that total is still under 5, label must hide it.
  if water_open_before + 3 < 5 then
    if after_open is distinct from 'fewer than 5' then
      raise exception 'small water open count was not hidden: %', after_open;
    end if;
    if after_exact is not null then
      raise exception 'small water open_count must be null, got %', after_exact;
    end if;
  end if;

  select open_label into after_open
  from public.public_status_by_category
  where category_id = 'water';

  insert into public.reports (
    id, title, description, category, location_id, location_detail, photos,
    confidential, anonymous, status, priority, department_id, reporter_id,
    created_at, updated_at, due_at, info_requested, blocks_access, contact_window
  ) values (
    'SF-PUBSTAT-C', 'Public status confidential fixture', 'Enough text for a confidential water story that must stay off public figures.',
    'water', 'dorm', 'Hidden tap', '[]'::jsonb, true, false, 'submitted', 'high', 'd-sec', 'u-amina',
    now(), now(), now() + interval '1 day', false, false, ''
  );

  select open_label, open_count into after_conf, after_conf_exact
  from public.public_status_by_category
  where category_id = 'water';

  if after_conf is distinct from after_open then
    raise exception 'confidential report changed public open_label from % to %', after_open, after_conf;
  end if;
  if after_conf_exact is distinct from after_exact then
    raise exception 'confidential report changed public open_count';
  end if;

  -- Harassment / safety / anonymous must not appear in category view keys.
  if exists (select 1 from public.public_status_by_category where category_id in ('harassment', 'safety')) then
    raise exception 'harassment/safety must not appear in public_status_by_category';
  end if;

  delete from public.reports where id like 'SF-PUBSTAT-%';
end $$;

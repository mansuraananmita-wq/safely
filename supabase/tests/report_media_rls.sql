-- An unrelated account cannot read a report voice file. The reporter can.

do $$
declare
  amina_auth uuid := 'a1111111-1111-4111-8111-111111111101';
  karim_auth uuid := 'a1111111-1111-4111-8111-111111111102';
  rid text := 'SF-MEDIA-RLS';
  object_name text := 'SF-MEDIA-RLS/voice.webm';
  owner_seen int := -1;
  other_seen int := -1;
begin
  if not exists (select 1 from public.profiles where id = 'u-amina' and auth_user_id = amina_auth) then
    raise exception 'seed profile u-amina with known auth id is required';
  end if;
  if not exists (select 1 from storage.buckets where id = 'report-media') then
    raise exception 'report-media bucket is required';
  end if;

  delete from public.reports where id = rid;

  insert into public.reports (
    id, title, description, category, location_id, location_detail, photos,
    confidential, anonymous, status, priority, reporter_id, created_at, updated_at, due_at
  ) values (
    rid,
    'Media RLS fixture',
    'A voice note attached to a campus lighting report for the storage policy test.',
    'lighting',
    'library',
    'Stairwell',
    '[]'::jsonb,
    false,
    false,
    'submitted',
    'medium',
    'u-amina',
    now(),
    now(),
    now() + interval '2 days'
  );

  if not exists (
    select 1 from storage.objects where bucket_id = 'report-media' and name = object_name
  ) then
    insert into storage.objects (bucket_id, name, metadata)
    values (
      'report-media',
      object_name,
      '{"mimetype":"audio/webm","size":1200}'::jsonb
    );
  end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', amina_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select count(*)::int into owner_seen
  from storage.objects
  where bucket_id = 'report-media' and name = object_name;
  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', karim_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  select count(*)::int into other_seen
  from storage.objects
  where bucket_id = 'report-media' and name = object_name;
  execute 'reset role';

  delete from public.reports where id = rid;

  if owner_seen <> 1 then
    raise exception 'reporter could not read own report media';
  end if;
  if other_seen <> 0 then
    raise exception 'unrelated user read report media';
  end if;
end $$;

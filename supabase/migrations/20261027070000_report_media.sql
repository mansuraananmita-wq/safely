-- Voice notes and short videos. Files live in a private bucket.
-- The reporter, the assigned office, and security can read them. The path is the report id, never the account id.

alter table public.reports add column if not exists voice_note jsonb;
alter table public.reports add column if not exists video jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-media',
  'report-media',
  false,
  20971520,
  array[
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/aac',
    'audio/x-m4a',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_read_report_media(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reports r
    where r.id = split_part(object_name, '/', 1)
      and (
        public.owns_report(r)
        or public.desk_role() = 'security'
        or (
          r.department_id is not null
          and public.desk_role() = 'department'
          and public.desk_department() = r.department_id
        )
      )
  );
$$;

create or replace function public.can_upload_report_media(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reports r
    where r.id = split_part(object_name, '/', 1)
      and public.owns_report(r)
  );
$$;

create or replace function public.report_media_file_ok(object_name text, meta jsonb)
returns boolean
language sql
stable
set search_path = public, storage
as $$
  select
    case
      when storage.filename(object_name) ~ '^voice\.(webm|m4a|mp3|aac)$'
        and coalesce(meta->>'mimetype', '') in ('audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a')
        and coalesce((meta->>'size')::bigint, 0) between 1 and 10485760
        then true
      when storage.filename(object_name) ~ '^video\.(mp4|webm|mov)$'
        and coalesce(meta->>'mimetype', '') in ('video/mp4', 'video/webm', 'video/quicktime')
        and coalesce((meta->>'size')::bigint, 0) between 1 and 20971520
        then true
      else false
    end;
$$;

revoke all on function public.can_read_report_media(text) from public, anon;
revoke all on function public.can_upload_report_media(text) from public, anon;
grant execute on function public.can_read_report_media(text) to authenticated;
grant execute on function public.can_upload_report_media(text) to authenticated;
grant execute on function public.report_media_file_ok(text, jsonb) to authenticated;

drop policy if exists report_media_select on storage.objects;
create policy report_media_select on storage.objects for select to authenticated
  using (
    bucket_id = 'report-media'
    and public.can_read_report_media(name)
  );

drop policy if exists report_media_insert on storage.objects;
create policy report_media_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'report-media'
    and public.can_upload_report_media(name)
    and public.report_media_file_ok(name, metadata)
  );

drop policy if exists report_media_update on storage.objects;
create policy report_media_update on storage.objects for update to authenticated
  using (bucket_id = 'report-media' and public.can_upload_report_media(name))
  with check (
    bucket_id = 'report-media'
    and public.can_upload_report_media(name)
    and public.report_media_file_ok(name, metadata)
  );

drop policy if exists report_media_delete on storage.objects;
create policy report_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'report-media' and public.can_upload_report_media(name));

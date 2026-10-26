-- Key/value campus settings. Signed-in users read; only admin writes.

create table if not exists public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select to authenticated
  using (true);

drop policy if exists app_settings_insert on public.app_settings;
create policy app_settings_insert on public.app_settings for insert to authenticated
  with check (public.is_admin());

drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists app_settings_delete on public.app_settings;
create policy app_settings_delete on public.app_settings for delete to authenticated
  using (public.is_admin());

grant select, insert, update, delete on public.app_settings to authenticated;

insert into public.app_settings (key, value)
values ('security_sms_number', '01XXXXXXXXX')
on conflict (key) do nothing;

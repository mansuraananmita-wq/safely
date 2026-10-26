-- Phone push tokens. A user can write only their own rows.

create table if not exists public.device_tokens (
  user_id text not null references public.profiles (id) on delete cascade,
  token text primary key,
  platform text not null check (platform in ('android', 'ios', 'web', 'other')),
  updated_at timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on public.device_tokens (user_id, updated_at desc);

alter table public.device_tokens enable row level security;

drop policy if exists device_tokens_select on public.device_tokens;
create policy device_tokens_select on public.device_tokens for select to authenticated
  using (user_id = public.current_profile_id());

drop policy if exists device_tokens_insert on public.device_tokens;
create policy device_tokens_insert on public.device_tokens for insert to authenticated
  with check (user_id = public.current_profile_id());

drop policy if exists device_tokens_update on public.device_tokens;
create policy device_tokens_update on public.device_tokens for update to authenticated
  using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());

drop policy if exists device_tokens_delete on public.device_tokens;
create policy device_tokens_delete on public.device_tokens for delete to authenticated
  using (user_id = public.current_profile_id());

grant select, insert, update, delete on public.device_tokens to authenticated;

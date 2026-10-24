create table public.analytics_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.analytics_visitors (
  visitor_id text primary key check (visitor_id ~ '^[a-f0-9]{64}$'),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table public.analytics_sessions (
  session_id text primary key check (session_id ~ '^[a-f0-9]{64}$'),
  visitor_id text not null references public.analytics_visitors (visitor_id) on delete cascade,
  last_seen timestamptz not null default now()
);

create index analytics_sessions_last_seen_idx on public.analytics_sessions (last_seen desc);

alter table public.analytics_admins enable row level security;
alter table public.analytics_visitors enable row level security;
alter table public.analytics_sessions enable row level security;

create or replace function public.is_analytics_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.analytics_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_analytics_admin() from public, anon;
grant execute on function public.is_analytics_admin() to authenticated;

create policy "Owners can read their own analytics role"
  on public.analytics_admins for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Owners can read visitor counts"
  on public.analytics_visitors for select to authenticated
  using ((select public.is_analytics_admin()));

create policy "Owners can read active sessions"
  on public.analytics_sessions for select to authenticated
  using ((select public.is_analytics_admin()));

revoke all on public.analytics_admins, public.analytics_visitors, public.analytics_sessions
  from anon, authenticated;
grant select on public.analytics_admins, public.analytics_visitors, public.analytics_sessions
  to authenticated;

create or replace function public.update_analytics_presence(
  p_visitor_id text,
  p_session_id text,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated_count integer;
begin
  if p_visitor_id is null or p_visitor_id !~ '^[a-f0-9]{64}$'
    or p_session_id is null or p_session_id !~ '^[a-f0-9]{64}$'
    or p_action is null or p_action not in ('start', 'ping', 'end', 'forget')
  then
    raise exception 'Invalid analytics presence request';
  end if;

  if p_action = 'forget' then
    delete from public.analytics_visitors where visitor_id = p_visitor_id;
    return;
  end if;

  if p_action = 'start' then
    insert into public.analytics_visitors (visitor_id)
    values (p_visitor_id)
    on conflict (visitor_id) do update set last_seen = now();

    insert into public.analytics_sessions (session_id, visitor_id)
    values (p_session_id, p_visitor_id)
    on conflict (session_id) do nothing;

    update public.analytics_sessions
    set last_seen = now()
    where session_id = p_session_id and visitor_id = p_visitor_id;
    get diagnostics v_updated_count = row_count;
    if v_updated_count = 0 then
      raise exception 'Analytics session does not match visitor';
    end if;
    return;
  end if;

  if p_action = 'ping' then
    update public.analytics_sessions
    set last_seen = now()
    where session_id = p_session_id and visitor_id = p_visitor_id;
  else
    update public.analytics_sessions
    set last_seen = now() - interval '2 minutes'
    where session_id = p_session_id and visitor_id = p_visitor_id;
  end if;

  get diagnostics v_updated_count = row_count;
  if v_updated_count = 0 then
    raise exception 'Analytics session does not match visitor';
  end if;

  if p_action = 'ping' then
    update public.analytics_visitors
    set last_seen = now()
    where visitor_id = p_visitor_id;
  end if;
end;
$$;

revoke all on function public.update_analytics_presence(text, text, text)
  from public, anon, authenticated;
grant execute on function public.update_analytics_presence(text, text, text)
  to service_role;

create or replace function public.get_analytics_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return jsonb_build_object(
    'unique_visitors', (select count(*) from public.analytics_visitors),
    'active_visitors', (
      select count(distinct visitor_id)
      from public.analytics_sessions
      where last_seen >= now() - interval '90 seconds'
    )
  );
end;
$$;

revoke all on function public.get_analytics_counts() from public;
grant execute on function public.get_analytics_counts() to anon, authenticated;

create or replace function public.cleanup_analytics_sessions()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.analytics_sessions
  where last_seen < now() - interval '7 days';
$$;

revoke all on function public.cleanup_analytics_sessions() from public, anon, authenticated;
grant execute on function public.cleanup_analytics_sessions() to service_role;

alter publication supabase_realtime add table public.analytics_sessions;

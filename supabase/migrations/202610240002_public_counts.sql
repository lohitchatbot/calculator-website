create or replace function public.get_analytics_counts()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'unique_visitors', (select count(*) from public.analytics_visitors),
    'active_visitors', (
      select count(distinct visitor_id)
      from public.analytics_sessions
      where last_seen >= now() - interval '90 seconds'
    )
  );
$$;

revoke all on function public.get_analytics_counts() from public;
grant execute on function public.get_analytics_counts() to anon, authenticated;

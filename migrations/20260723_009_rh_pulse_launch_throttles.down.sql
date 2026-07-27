-- Rate-limit buckets are disposable launch controls and contain no public provenance.
begin;

drop table if exists rh_pulse_rate_limit_buckets;

do $$
begin
  if to_regclass('public.infopunks_schema_migrations') is not null then
    execute 'delete from infopunks_schema_migrations where migration_id = ''20260723_009''';
  end if;
end $$;

commit;

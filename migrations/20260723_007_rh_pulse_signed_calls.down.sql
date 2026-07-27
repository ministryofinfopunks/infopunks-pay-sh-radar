-- Refuse destructive rollback once a signed public call exists.
begin;

do $$
begin
  if exists (select 1 from rh_pulse_calls limit 1) then
    raise exception 'unsafe rollback: signed RH Pulse calls exist';
  end if;
end $$;

drop trigger if exists rh_pulse_call_receipts_immutable on rh_pulse_call_receipts;
drop function if exists rh_pulse_reject_receipt_mutation();
drop table if exists rh_pulse_audit_events;
drop table if exists rh_pulse_call_receipts;
drop table if exists rh_pulse_calls;
drop table if exists rh_pulse_call_challenges;
drop table if exists rh_pulse_windows;
drop table if exists rh_pulse_counters;

do $$
begin
  if to_regclass('public.infopunks_schema_migrations') is not null then
    execute 'delete from infopunks_schema_migrations where migration_id = ''20260723_007''';
  end if;
end $$;

commit;

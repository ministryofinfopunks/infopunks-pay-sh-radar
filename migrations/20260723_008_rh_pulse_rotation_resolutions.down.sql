-- Refuse destructive rollback after an immutable Rotation Receipt is published.
begin;

do $$
begin
  if exists (select 1 from rh_pulse_rotation_receipts limit 1) then
    raise exception 'unsafe rollback: published RH Pulse Rotation Receipts exist';
  end if;
end $$;

delete from rh_pulse_audit_events where event_type in (
  'resolution_previewed',
  'resolution_blocked',
  'resolution_draft_created',
  'resolution_approved',
  'resolution_cancelled',
  'resolution_published',
  'resolution_publication_conflict',
  'rotation_receipt_created',
  'resolution_transaction_rolled_back'
);

alter table rh_pulse_audit_events
  drop constraint if exists rh_pulse_audit_events_event_type_check;
alter table rh_pulse_audit_events
  add constraint rh_pulse_audit_events_event_type_check check (event_type in (
    'challenge_created',
    'challenge_rejected',
    'signature_verified',
    'signature_rejected',
    'call_accepted',
    'duplicate_call_rejected',
    'receipt_created',
    'window_created',
    'window_opened',
    'window_closed',
    'window_cancelled',
    'abuse_check_triggered'
  ));

drop trigger if exists rh_pulse_rotation_receipts_immutable on rh_pulse_rotation_receipts;
drop trigger if exists rh_pulse_rotation_receipts_validate on rh_pulse_rotation_receipts;
drop function if exists rh_pulse_reject_rotation_receipt_mutation();
drop function if exists rh_pulse_validate_rotation_receipt_publication();
drop table if exists rh_pulse_rotation_receipts;
drop trigger if exists rh_pulse_resolution_runs_published_immutable on rh_pulse_resolution_runs;
drop function if exists rh_pulse_reject_published_resolution_run_mutation();
drop table if exists rh_pulse_resolution_runs;

do $$
begin
  if to_regclass('public.infopunks_schema_migrations') is not null then
    execute 'delete from infopunks_schema_migrations where migration_id = ''20260723_008''';
  end if;
end $$;

commit;

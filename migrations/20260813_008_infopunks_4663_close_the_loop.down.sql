-- Rollback is allowed only before any immutable Phase 2 history exists.
do $$
begin
  if exists (select 1 from rh_4663_resolution_receipts limit 1)
     or exists (select 1 from rh_4663_pulse_window_resolutions limit 1)
     or exists (select 1 from rh_4663_window_anchors limit 1) then
    raise exception 'unsafe rollback: immutable 4663 RESOLUTION or anchor history exists; remediate forward';
  end if;
end $$;

drop trigger if exists rh_4663_published_resolution_immutable on rh_4663_pulse_window_resolutions;
drop trigger if exists rh_4663_resolution_receipts_immutable on rh_4663_resolution_receipts;
drop trigger if exists rh_4663_confirmed_anchor_immutable on rh_4663_window_anchors;
drop function if exists rh_4663_protect_confirmed_anchor();
drop function if exists rh_4663_protect_published_resolution();
drop function if exists rh_4663_reject_resolution_receipt_mutation();
drop table if exists rh_4663_window_anchors;
drop table if exists rh_4663_resolution_receipts;
drop table if exists rh_4663_pulse_window_resolutions;

-- Protocol receipts and Genesis provenance are intentionally rollback-protected.
do $$
begin
  if exists (select 1 from rh_4663_pulse_calls limit 1)
     or exists (select 1 from rh_4663_genesis_wallets limit 1) then
    raise exception 'unsafe rollback: immutable 4663 protocol receipts or Genesis provenance exist';
  end if;
end $$;

drop table if exists rh_4663_signals;
drop table if exists rh_4663_today_editions;
drop table if exists rh_4663_events;
drop table if exists rh_4663_pulse_calls;
drop table if exists rh_4663_genesis_wallets;

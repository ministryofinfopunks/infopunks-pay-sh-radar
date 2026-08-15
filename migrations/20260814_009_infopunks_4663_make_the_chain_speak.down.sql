-- Phase 3 rollback is safe only before public memory or finder attribution exists.
-- Once either exists, remediate forward so market history cannot be erased.
do $$
begin
  if exists (select 1 from rh_4663_signal_publications limit 1)
     or exists (select 1 from rh_4663_signal_corrections limit 1)
     or exists (select 1 from rh_4663_observations where submitted_by is not null limit 1) then
    raise exception 'unsafe rollback: published 4663 Signals, corrections, or source attribution exist; remediate forward';
  end if;
end $$;

drop trigger if exists rh_4663_signal_corrections_immutable on rh_4663_signal_corrections;
drop trigger if exists rh_4663_signal_publications_immutable on rh_4663_signal_publications;
drop function if exists rh_4663_reject_signal_correction_mutation();
drop function if exists rh_4663_reject_signal_publication_mutation();
drop table if exists rh_4663_provider_health;
drop table if exists rh_4663_signal_corrections;
drop table if exists rh_4663_signal_distribution;
drop table if exists rh_4663_signal_publications;
drop table if exists rh_4663_signal_candidates;
drop table if exists rh_4663_observations;

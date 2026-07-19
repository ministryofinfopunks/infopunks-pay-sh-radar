begin;

do $$
begin
  if exists (select 1 from rh_chain_reviewed_classifications where primary_layer = 'consumer') then
    raise exception 'Cannot roll back RH Chain layer vocabulary while consumer classifications exist';
  end if;
end $$;

alter table rh_chain_reviewed_classifications
  drop constraint rh_chain_reviewed_classifications_primary_layer_check;

alter table rh_chain_reviewed_classifications
  add constraint rh_chain_reviewed_classifications_primary_layer_check
  check (primary_layer in ('meme', 'rwa', 'agent', 'infrastructure', 'defi', 'unknown'));

commit;

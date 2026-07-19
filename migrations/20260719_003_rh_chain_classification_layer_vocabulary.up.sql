begin;

alter table rh_chain_reviewed_classifications
  drop constraint rh_chain_reviewed_classifications_primary_layer_check;

alter table rh_chain_reviewed_classifications
  add constraint rh_chain_reviewed_classifications_primary_layer_check
  check (primary_layer in ('meme', 'rwa', 'agent', 'infrastructure', 'defi', 'consumer', 'unknown'));

commit;

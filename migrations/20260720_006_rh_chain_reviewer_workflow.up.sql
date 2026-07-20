-- Apply through the normal migration runner. Never run during application startup.
-- Contract relationships are deliberately separate from submitted project payloads.
create table if not exists rh_chain_project_contract_relationships (
  relationship_id text primary key,
  project_id text not null references rh_chain_projects(project_id) on delete restrict,
  chain text not null check (chain = 'robinhood'),
  exact_contract text not null check (exact_contract ~ '^0x[0-9a-f]{40}$'),
  relationship_type text not null,
  verification_state text not null,
  version integer not null check (version > 0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  payload jsonb not null
);
create index if not exists rh_chain_project_contract_relationships_project_idx
  on rh_chain_project_contract_relationships (project_id, updated_at desc);
create index if not exists rh_chain_project_contract_relationships_contract_idx
  on rh_chain_project_contract_relationships (chain, exact_contract, updated_at desc);
create unique index if not exists rh_chain_project_contract_relationships_active_contract_idx
  on rh_chain_project_contract_relationships (chain, exact_contract)
  where verification_state in ('reviewed', 'verified');
create unique index if not exists rh_chain_project_contract_relationships_active_primary_idx
  on rh_chain_project_contract_relationships (project_id)
  where relationship_type = 'primary' and verification_state in ('reviewed', 'verified');

-- Apply through the normal migration runner. Never run during application startup.
create table if not exists rh_chain_projects (
  project_id text primary key, chain text not null check (chain = 'robinhood'), primary_contract text not null,
  canonical_slug text not null, identity_status text not null, version integer not null check (version > 0),
  created_at timestamptz not null, updated_at timestamptz not null, payload jsonb not null,
  unique (chain, primary_contract)
);
create unique index if not exists rh_chain_projects_slug_idx on rh_chain_projects (canonical_slug);
create index if not exists rh_chain_projects_review_idx on rh_chain_projects (updated_at desc);
create table if not exists rh_chain_project_claims (claim_id text primary key, project_id text not null references rh_chain_projects(project_id), payload jsonb not null);
create table if not exists rh_chain_project_evidence (evidence_id text primary key, project_id text not null references rh_chain_projects(project_id), payload jsonb not null);
create table if not exists rh_chain_project_observations (observation_id text primary key, project_id text not null references rh_chain_projects(project_id), payload jsonb not null);
create table if not exists rh_chain_project_verdicts (verdict_id text primary key, project_id text not null references rh_chain_projects(project_id), payload jsonb not null);
create table if not exists rh_chain_intelligence_receipts (receipt_id text primary key, project_id text not null references rh_chain_projects(project_id), payload jsonb not null);
create table if not exists rh_chain_project_audit (audit_id text primary key, project_id text not null references rh_chain_projects(project_id), action text not null, reviewer_id text, occurred_at timestamptz not null, payload jsonb not null);
create index if not exists rh_chain_project_claims_project_idx on rh_chain_project_claims (project_id);
create index if not exists rh_chain_project_evidence_project_idx on rh_chain_project_evidence (project_id);
create index if not exists rh_chain_project_observations_project_idx on rh_chain_project_observations (project_id);
create index if not exists rh_chain_project_verdicts_project_idx on rh_chain_project_verdicts (project_id);
create index if not exists rh_chain_intelligence_receipts_project_idx on rh_chain_intelligence_receipts (project_id);
create unique index if not exists rh_chain_intelligence_receipts_integrity_hash_idx on rh_chain_intelligence_receipts ((payload->>'integrity_hash')) where payload->>'integrity_hash' is not null;
create index if not exists rh_chain_project_audit_project_idx on rh_chain_project_audit (project_id, occurred_at desc);

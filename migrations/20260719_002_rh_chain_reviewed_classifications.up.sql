begin;

create table rh_chain_reviewed_classifications (
  chain text not null,
  contract text not null,
  primary_layer text not null,
  review_status text not null,
  classification_version integer not null,
  effective_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  payload jsonb not null,
  primary key (chain, contract),
  constraint rh_chain_reviewed_classifications_chain_check check (chain = 'robinhood'),
  constraint rh_chain_reviewed_classifications_contract_check check (contract ~ '^0x[0-9a-f]{40}$'),
  constraint rh_chain_reviewed_classifications_primary_layer_check check (primary_layer in ('meme', 'rwa', 'agent', 'infrastructure', 'defi', 'unknown')),
  constraint rh_chain_reviewed_classifications_status_check check (review_status in ('proposed', 'source_required', 'under_review', 'approved', 'rejected', 'superseded', 'archived')),
  constraint rh_chain_reviewed_classifications_version_check check (classification_version > 0),
  constraint rh_chain_reviewed_classifications_payload_check check (jsonb_typeof(payload) = 'object'),
  constraint rh_chain_reviewed_classifications_timestamps_check check (updated_at >= created_at),
  constraint rh_chain_reviewed_classifications_approved_check check (review_status <> 'approved' or effective_at is not null),
  constraint rh_chain_reviewed_classifications_approved_active_check check (review_status <> 'approved' or superseded_at is null),
  constraint rh_chain_reviewed_classifications_superseded_check check (review_status <> 'superseded' or superseded_at is not null)
);

create table rh_chain_reviewed_classification_audit (
  event_id uuid primary key,
  chain text not null,
  contract text not null,
  classification_version integer not null,
  action text not null,
  reviewer_id text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  constraint rh_chain_reviewed_classification_audit_chain_check check (chain = 'robinhood'),
  constraint rh_chain_reviewed_classification_audit_contract_check check (contract ~ '^0x[0-9a-f]{40}$'),
  constraint rh_chain_reviewed_classification_audit_version_check check (classification_version > 0),
  constraint rh_chain_reviewed_classification_audit_action_check check (action in ('proposed', 'approved', 'rejected', 'superseded')),
  constraint rh_chain_reviewed_classification_audit_reviewer_check check (reviewer_id ~ '^[A-Za-z0-9._:@-]{1,64}$'),
  constraint rh_chain_reviewed_classification_audit_payload_check check (jsonb_typeof(payload) = 'object'),
  constraint rh_chain_reviewed_classification_audit_version_unique unique (chain, contract, classification_version),
  constraint rh_chain_reviewed_classification_audit_record_fk foreign key (chain, contract) references rh_chain_reviewed_classifications (chain, contract) on delete restrict
);

create index rh_chain_reviewed_classifications_status_updated_idx
  on rh_chain_reviewed_classifications (review_status, updated_at desc, contract);
create index rh_chain_reviewed_classifications_approved_effective_idx
  on rh_chain_reviewed_classifications (effective_at desc, contract)
  where review_status = 'approved' and superseded_at is null;
create index rh_chain_reviewed_classification_audit_contract_time_idx
  on rh_chain_reviewed_classification_audit (chain, contract, occurred_at desc, classification_version desc, event_id);

commit;

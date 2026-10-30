begin;
create table canonical_receipt_acceptances (
  acceptance_sequence bigserial primary key,
  receipt_kind text not null check (receipt_kind in ('observation','judgment','execution','evaluation')),
  receipt_id text not null,
  receipt_hash text not null check (receipt_hash ~ '^sha256:[a-f0-9]{64}$'),
  accepted_at timestamptz not null default now(),
  unique(receipt_kind, receipt_id)
);
create index canonical_receipt_acceptances_kind_sequence on canonical_receipt_acceptances(receipt_kind, acceptance_sequence);
create trigger canonical_receipt_acceptances_immutable before update or delete on canonical_receipt_acceptances
  for each row execute function canonical_receipt_immutable();
create trigger canonical_receipt_acceptances_no_truncate before truncate on canonical_receipt_acceptances
  for each statement execute function canonical_receipt_immutable();
create table canonical_receipt_quarantine (
  receipt_kind text not null, receipt_id text not null, receipt_hash text not null,
  reason text not null, quarantined_at timestamptz not null default now(),
  primary key(receipt_kind, receipt_id, receipt_hash)
);
create trigger canonical_receipt_quarantine_immutable before update or delete on canonical_receipt_quarantine
  for each row execute function canonical_receipt_immutable();
create trigger canonical_receipt_quarantine_no_truncate before truncate on canonical_receipt_quarantine
  for each statement execute function canonical_receipt_immutable();
alter table decision_contexts drop constraint decision_contexts_context_check1;
alter table decision_contexts add constraint decision_contexts_version_check check (context->>'version' in ('pre-spend-decision-context.v1','pre-spend-decision-context.v2'));
commit;

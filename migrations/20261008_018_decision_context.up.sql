begin;
create table decision_contexts (
  assessment_id text primary key,
  context_hash text not null unique check (context_hash ~ '^sha256:[a-f0-9]{64}$'),
  context jsonb not null check (jsonb_typeof(context) = 'object'),
  check (context->>'assessment_id' = assessment_id and context->>'context_hash' = context_hash),
  check (context->>'version' = 'pre-spend-decision-context.v1')
);
create trigger decision_contexts_immutable before update or delete on decision_contexts
  for each row execute function canonical_receipt_immutable();
create trigger decision_contexts_no_truncate before truncate on decision_contexts
  for each statement execute function canonical_receipt_immutable();

do $$ declare item record; begin
  for item in select conname from pg_constraint where conrelid='judgment_receipts'::regclass
    and contype='c' and pg_get_constraintdef(oid) like '%schema_version%'
  loop execute format('alter table judgment_receipts drop constraint %I', item.conname); end loop;
end $$;
alter table judgment_receipts add constraint judgment_receipt_version_context_check check (
  (receipt->>'schema_version'='canonical-receipts.v1' and not (receipt ? 'decision_context_hash') and receipt->>'policy_version'='receipt-authority.v1')
  or (receipt->>'schema_version'='canonical-receipts.v2' and receipt->>'decision_context_hash' ~ '^sha256:[a-f0-9]{64}$' and receipt->>'policy_version'='receipt-authority.v2')
);
create function canonical_judgment_context_valid() returns trigger language plpgsql as $$
begin
  if new.receipt->>'schema_version' = 'canonical-receipts.v2' and not exists (
    select 1 from decision_contexts c where c.assessment_id = new.judgment_id
      and c.context_hash = new.receipt->>'decision_context_hash'
  ) then raise exception 'decision_context_missing' using errcode = '23514'; end if;
  return new;
end;
$$;
create constraint trigger canonical_judgment_context after insert on judgment_receipts
  deferrable initially deferred for each row execute function canonical_judgment_context_valid();
commit;

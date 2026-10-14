begin;
-- Ownership is metadata outside signed receipt bodies. Absence means quarantined, operator-only.
create table canonical_receipt_ownership (
 receipt_kind text not null check(receipt_kind in ('observation','judgment','execution','evaluation')),
 receipt_id text not null, receipt_hash text not null,
 tenant_id text not null check(length(tenant_id) between 1 and 128),
 principal_id text not null check(length(principal_id) between 1 and 128),
 admitted_at timestamptz not null default clock_timestamp(), primary key(receipt_kind,receipt_id)
);
create function canonical_ownership_validate() returns trigger language plpgsql as $$
declare body jsonb; parent_id text; parent_kind text; context jsonb;
begin
 case new.receipt_kind
  when 'observation' then select receipt into body from observation_receipts where observation_id=new.receipt_id;
  when 'judgment' then select receipt into body from judgment_receipts where judgment_id=new.receipt_id;
  when 'execution' then select receipt into body from execution_receipts where execution_id=new.receipt_id;
  when 'evaluation' then select receipt into body from evaluation_receipts where evaluation_id=new.receipt_id;
 end case;
 if body is null or body->>'receipt_hash' <> new.receipt_hash then raise exception 'ownership_receipt_mismatch' using errcode='23514'; end if;
 if new.receipt_kind='judgment' then
  for parent_id in select jsonb_array_elements_text(body->'cited_observation_ids') loop
   if not exists(select 1 from canonical_receipt_ownership where receipt_kind='observation' and receipt_id=parent_id and tenant_id=new.tenant_id) then raise exception 'tenant_parent_mismatch' using errcode='23514'; end if;
  end loop;
  select decision_contexts.context into context from decision_contexts where assessment_id=new.receipt_id;
  if body->>'schema_version'='canonical-receipts.v2' and context is null then raise exception 'tenant_context_missing' using errcode='23514'; end if;
  for parent_id in select r->>'evaluation_id' from jsonb_array_elements(coalesce(context->'evaluation_refs','[]'::jsonb)) r loop
   if not exists(select 1 from canonical_receipt_ownership where receipt_kind='evaluation' and receipt_id=parent_id and tenant_id=new.tenant_id) then raise exception 'tenant_parent_mismatch' using errcode='23514'; end if;
  end loop;
 elsif new.receipt_kind in ('execution','evaluation') then
  parent_kind := case new.receipt_kind when 'execution' then 'judgment' else 'execution' end;
  parent_id := body->>(parent_kind || '_id');
  if not exists(select 1 from canonical_receipt_ownership where receipt_kind=parent_kind and receipt_id=parent_id and tenant_id=new.tenant_id) then raise exception 'tenant_parent_mismatch' using errcode='23514'; end if;
 end if;
 return new;
end; $$;
create trigger ownership_validate before insert on canonical_receipt_ownership for each row execute function canonical_ownership_validate();
create index canonical_receipt_ownership_tenant_idx on canonical_receipt_ownership(tenant_id,receipt_kind,receipt_id);
create function canonical_access_immutable() returns trigger language plpgsql as $$
begin raise exception 'canonical access metadata is immutable' using errcode='55000'; end; $$;
create trigger ownership_immutable before update or delete or truncate on canonical_receipt_ownership for each statement execute function canonical_access_immutable();
create table canonical_public_proofs (
 proof_id text primary key, judgment_id text not null references judgment_receipts(judgment_id),
 export jsonb not null, export_hash text not null, approved_by text not null, approved_at timestamptz not null default clock_timestamp()
);
create trigger public_proofs_immutable before update or delete or truncate on canonical_public_proofs for each statement execute function canonical_access_immutable();
create table canonical_public_proof_events (
 event_id bigint generated always as identity primary key, proof_id text not null references canonical_public_proofs(proof_id),
 action text not null check(action in ('approved','withdrawn')), principal_id text not null, reason_code text not null,
 created_at timestamptz not null default clock_timestamp()
);
create trigger proof_events_immutable before update or delete or truncate on canonical_public_proof_events for each statement execute function canonical_access_immutable();
create table canonical_public_rate_limits (bucket text primary key, window_start bigint not null, hits integer not null);
commit;

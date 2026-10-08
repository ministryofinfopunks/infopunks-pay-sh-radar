begin;
create table if not exists economic_engine_records (
  kind text not null check (kind in ('attempt','reservation','authorization','execution','trace','cost','evaluation','revocation')),
  id text not null,
  record jsonb not null check (jsonb_typeof(record)='object'),
  record_hash text not null check (record_hash ~ '^sha256:[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key(kind,id)
);
create index if not exists economic_engine_principal_idx on economic_engine_records(kind,(record->>'principal_id'));
create unique index if not exists economic_engine_nonce_idx on economic_engine_records((record->'payload'->>'nonce')) where kind='authorization';
create unique index if not exists economic_engine_settlement_idx on economic_engine_records((record->>'chain_id'),(record->'outcome'->>'settlement_ref')) where kind='execution' and record->'outcome'->>'settlement_ref' is not null;
create or replace function protect_economic_engine_memory() returns trigger language plpgsql as $$
begin
  if TG_OP='DELETE' then raise exception 'economic memory is append-only' using errcode='55000'; end if;
  if old.kind <> new.kind or old.id <> new.id or old.created_at <> new.created_at then raise exception 'economic record identity is immutable' using errcode='55000'; end if;
  if old.kind not in ('attempt','reservation','execution') and old.record is distinct from new.record then raise exception 'economic memory is append-only' using errcode='55000'; end if;
  if old.kind='attempt' and old.record is distinct from new.record then
    if (old.record - array['status','witness','result','judgment','authorization','reservation_id','assessed_at','valid_until']) is distinct from
       (new.record - array['status','witness','result','judgment','authorization','reservation_id','assessed_at','valid_until'])
       or not ((old.record->>'status'='evaluating' and new.record->>'status'='assessed') or (old.record->>'status'='assessed' and new.record->>'status'='complete'))
    then raise exception 'invalid decision attempt transition' using errcode='55000'; end if;
  end if;
  if old.kind='reservation' and old.record is distinct from new.record then
    if (old.record - array['state','actual_amount_atomic']) is distinct from (new.record - array['state','actual_amount_atomic'])
       or not ((old.record->>'state'='reserved' and new.record->>'state' in ('authorized','released'))
         or (old.record->>'state'='authorized' and new.record->>'state' in ('submitted','released'))
         or (old.record->>'state'='submitted' and new.record->>'state'='finalized'))
    then raise exception 'invalid spend reservation transition' using errcode='55000'; end if;
  end if;
  if old.kind='execution' and old.record is distinct from new.record then
    if (old.record - array['state','outcome','receipt','latency_ms']) is distinct from (new.record - array['state','outcome','receipt','latency_ms'])
       or not ((old.record->>'state'='submitted' and new.record->>'state' in ('submitted','verified'))
         or (old.record->>'state'='verified' and new.record->>'state'='finalized'))
       or (old.record->>'state'=new.record->>'state' and (old.record->'outcome' is distinct from new.record->'outcome' or old.record->'receipt' is distinct from new.record->'receipt'))
    then raise exception 'invalid economic execution transition' using errcode='55000'; end if;
  end if;
  return new;
end $$;
drop trigger if exists economic_engine_memory_guard on economic_engine_records;
create trigger economic_engine_memory_guard before update or delete on economic_engine_records for each row execute function protect_economic_engine_memory();
commit;

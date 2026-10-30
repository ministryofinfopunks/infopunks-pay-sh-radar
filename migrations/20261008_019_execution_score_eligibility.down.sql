begin;
do $$ begin
  if exists (select 1 from execution_receipts where receipt->'score_eligibility'->>'state'='qualifying') then
    raise exception 'refusing to remove qualifying execution replay protection';
  end if;
end $$;
drop index execution_qualifying_judgment_once_idx;
drop index execution_qualifying_settlement_once_idx;
commit;

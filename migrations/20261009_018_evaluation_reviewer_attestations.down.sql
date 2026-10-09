begin;
do $$ begin
  if exists (select 1 from evaluation_reviewer_attestations) then
    raise exception 'cannot_remove_accepted_evaluation_attestations';
  end if;
end $$;
drop trigger evaluation_reviewer_attestation_matches on evaluation_receipts;
drop function evaluation_reviewer_attestation_matches();
alter table evaluation_receipts drop constraint evaluation_score_policy_valid;
alter table evaluation_receipts add constraint evaluation_score_policy_valid check ((
  (receipt->>'policy_version'='receipt-authority.v1' and
    (receipt->>'score_delta')::numeric = case receipt->>'outcome' when 'confirmed' then 5 when 'weakened' then -2 when 'contradicted' then -5 end)
  or (receipt->>'policy_version'='score-policy.v1' and
    (receipt->>'score_delta')::numeric = case receipt->>'outcome' when 'confirmed' then 5 when 'weakened' then -2 when 'contradicted' then -15 end
    and receipt->'evaluator'->>'verification'='internal' and receipt->'evaluator'->>'type'='internal'
    and receipt->'evaluator'->>'id' in ('canonical-admin','evaluation-service'))
) is true);
drop trigger evaluation_reviewer_attestations_no_truncate on evaluation_reviewer_attestations;
drop trigger evaluation_reviewer_attestations_immutable on evaluation_reviewer_attestations;
drop table evaluation_reviewer_attestations;
commit;

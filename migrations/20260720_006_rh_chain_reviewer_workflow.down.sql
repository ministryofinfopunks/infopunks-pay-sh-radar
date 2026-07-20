-- Refuse rollback if active reviewed relationships would lose their canonical storage.
do $$
begin
  if exists (
    select 1 from rh_chain_project_contract_relationships
    where verification_state in ('reviewed', 'verified')
  ) then
    raise exception 'unsafe rollback: active RH Chain contract relationships exist';
  end if;
end $$;
drop table if exists rh_chain_project_contract_relationships;

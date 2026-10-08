DO $$ BEGIN RAISE EXCEPTION 'accounting rollback requires code/traffic rollback; retain append-only revenue, costs and RH execution uniqueness'; END $$;

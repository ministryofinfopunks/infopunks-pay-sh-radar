DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM judgment_requests LIMIT 1) THEN
    RAISE EXCEPTION 'refusing to remove nonempty payment journal';
  END IF;
END $$;
DROP INDEX IF EXISTS observation_receipts_judgment_scope_idx;
DROP TABLE IF EXISTS judgment_requests;

-- Preserve earlier applied migrations. A branch UPDATE must validate both grants.
CREATE OR REPLACE FUNCTION check_grant_branches() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE grant_id uuid; grant_ids uuid[]; grant_scope "AccessScope"; branch_count bigint;
BEGIN
 IF TG_TABLE_NAME = 'user_roles' THEN grant_ids := ARRAY[COALESCE(NEW.id, OLD.id)];
 ELSIF TG_OP = 'INSERT' THEN grant_ids := ARRAY[NEW.user_role_id];
 ELSIF TG_OP = 'DELETE' THEN grant_ids := ARRAY[OLD.user_role_id];
 ELSE grant_ids := ARRAY[OLD.user_role_id, NEW.user_role_id]; END IF;
 FOR grant_id IN SELECT DISTINCT id FROM unnest(grant_ids) AS ids(id) ORDER BY id LOOP
  SELECT scope INTO grant_scope FROM user_roles WHERE id = grant_id FOR UPDATE;
  IF NOT FOUND THEN CONTINUE; END IF;
  SELECT count(*) INTO branch_count FROM user_role_branches WHERE user_role_id = grant_id;
  IF (grant_scope = 'BRANCH' AND branch_count <> 1)
  OR (grant_scope = 'BRANCH_SET' AND branch_count < 1)
  OR (grant_scope IN ('OWN','ORGANIZATION') AND branch_count <> 0) THEN
   RAISE EXCEPTION 'Invalid grant branch cardinality' USING ERRCODE = '23514';
  END IF;
 END LOOP;
 RETURN NULL;
END $$;

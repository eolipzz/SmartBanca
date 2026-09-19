BEGIN;

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS auth_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  purpose varchar(24) NOT NULL CHECK (purpose IN ('verify_email','reset_password')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_token_user_purpose_idx ON auth_token(user_id,purpose,created_at DESC);

CREATE TABLE IF NOT EXISTS auth_rate_limit (
  key_hash char(64) PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz
);

ALTER TABLE auth_token ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_token FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_token_own ON auth_token;
CREATE POLICY auth_token_own ON auth_token USING (user_id=current_app_user_id()) WITH CHECK (user_id=current_app_user_id());

CREATE OR REPLACE FUNCTION audit_private_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_user uuid := COALESCE(NEW.user_id, OLD.user_id, current_app_user_id());
BEGIN
  INSERT INTO audit_event(user_id,action,entity_type,entity_id,metadata)
  VALUES(v_user, TG_TABLE_NAME || '.' || lower(TG_OP), TG_TABLE_NAME, COALESCE(NEW.id,OLD.id), jsonb_build_object('at',now()));
  RETURN COALESCE(NEW,OLD);
END $$;

DROP TRIGGER IF EXISTS audit_bank_transaction ON bank_transaction;
CREATE TRIGGER audit_bank_transaction AFTER INSERT OR UPDATE OR DELETE ON bank_transaction FOR EACH ROW EXECUTE FUNCTION audit_private_change();
DROP TRIGGER IF EXISTS audit_bet_change ON bet;
CREATE TRIGGER audit_bet_change AFTER INSERT OR DELETE ON bet FOR EACH ROW EXECUTE FUNCTION audit_private_change();

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='smartbanca_app') THEN
    GRANT USAGE ON SCHEMA public TO smartbanca_app;
    GRANT SELECT,INSERT,UPDATE,DELETE ON app_user,bank_transaction,bet,audit_event,private_profile,auth_token,auth_rate_limit TO smartbanca_app;
    GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO smartbanca_app;
    GRANT EXECUTE ON FUNCTION current_app_user_id(),lookup_login_user(text),settle_bet(uuid,bet_status,numeric),save_private_notes(text) TO smartbanca_app;
  END IF;
END $$;

COMMIT;

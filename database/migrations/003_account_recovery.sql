BEGIN;

CREATE OR REPLACE FUNCTION verify_email_with_token(p_token_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM auth_token
  WHERE token_hash=p_token_hash AND purpose='verify_email'
    AND used_at IS NULL AND expires_at>now()
  FOR UPDATE;
  IF v_user_id IS NULL THEN RETURN false; END IF;
  UPDATE app_user SET email_verified_at=COALESCE(email_verified_at,now()) WHERE id=v_user_id;
  UPDATE auth_token SET used_at=now() WHERE token_hash=p_token_hash;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION reset_password_with_token(p_token_hash text, p_password_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM auth_token
  WHERE token_hash=p_token_hash AND purpose='reset_password'
    AND used_at IS NULL AND expires_at>now()
  FOR UPDATE;
  IF v_user_id IS NULL THEN RETURN false; END IF;
  UPDATE app_user SET password_hash=p_password_hash, failed_login_attempts=0, locked_until=NULL WHERE id=v_user_id;
  UPDATE auth_token SET used_at=now() WHERE user_id=v_user_id AND purpose='reset_password' AND used_at IS NULL;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION verify_email_with_token(text),reset_password_with_token(text,text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='smartbanca_app') THEN
    GRANT EXECUTE ON FUNCTION verify_email_with_token(text),reset_password_with_token(text,text) TO smartbanca_app;
  END IF;
END $$;

COMMIT;

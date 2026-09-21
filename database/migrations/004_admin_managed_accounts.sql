BEGIN;

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS account_active boolean NOT NULL DEFAULT true;

UPDATE app_user SET role='admin'
WHERE id=(SELECT id FROM app_user ORDER BY created_at LIMIT 1)
  AND NOT EXISTS(SELECT 1 FROM app_user WHERE role='admin')
  AND (SELECT count(*) FROM app_user)=1;

DROP POLICY IF EXISTS user_registration ON app_user;

DROP FUNCTION IF EXISTS lookup_login_user(text);
CREATE FUNCTION lookup_login_user(p_email text)
RETURNS TABLE(id uuid,name varchar,password_hash text,role user_role,failed_login_attempts smallint,locked_until timestamptz,must_change_password boolean,account_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_catalog AS $$
  SELECT u.id,u.name,u.password_hash,u.role,u.failed_login_attempts,u.locked_until,u.must_change_password,u.account_active
  FROM app_user u WHERE lower(u.email)=lower(p_email) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION is_current_user_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_catalog AS $$
  SELECT EXISTS(SELECT 1 FROM app_user WHERE id=current_app_user_id() AND role='admin' AND account_active)
$$;

CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS TABLE(id uuid,name varchar,email varchar,role user_role,must_change_password boolean,account_active boolean,created_at timestamptz,last_login_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
BEGIN
  IF NOT is_current_user_admin() THEN RAISE EXCEPTION 'Acesso administrativo negado' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT u.id,u.name,u.email,u.role,u.must_change_password,u.account_active,u.created_at,u.last_login_at
  FROM app_user u ORDER BY u.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION admin_create_user(p_name varchar,p_email varchar,p_password_hash text)
RETURNS TABLE(id uuid,name varchar,email varchar,must_change_password boolean,account_active boolean,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
BEGIN
  IF NOT is_current_user_admin() THEN RAISE EXCEPTION 'Acesso administrativo negado' USING ERRCODE='42501'; END IF;
  RETURN QUERY INSERT INTO app_user(name,email,password_hash,email_verified_at,must_change_password,account_active)
  VALUES(trim(p_name),lower(trim(p_email)),p_password_hash,now(),true,true)
  RETURNING app_user.id,app_user.name,app_user.email,app_user.must_change_password,app_user.account_active,app_user.created_at;
END $$;

CREATE OR REPLACE FUNCTION admin_create_reset_token(p_user_id uuid,p_token_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
BEGIN
  IF NOT is_current_user_admin() THEN RAISE EXCEPTION 'Acesso administrativo negado' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM app_user WHERE id=p_user_id AND role='user') THEN RETURN false; END IF;
  UPDATE auth_token SET used_at=now() WHERE user_id=p_user_id AND purpose='reset_password' AND used_at IS NULL;
  INSERT INTO auth_token(user_id,token_hash,purpose,expires_at) VALUES(p_user_id,p_token_hash,'reset_password',now()+interval '30 minutes');
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION admin_set_user_active(p_user_id uuid,p_active boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
BEGIN
  IF NOT is_current_user_admin() THEN RAISE EXCEPTION 'Acesso administrativo negado' USING ERRCODE='42501'; END IF;
  UPDATE app_user SET account_active=p_active WHERE id=p_user_id AND role='user';
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION change_own_password(p_password_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
BEGIN
  UPDATE app_user SET password_hash=p_password_hash,must_change_password=false,failed_login_attempts=0,locked_until=NULL
  WHERE id=current_app_user_id() AND account_active;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION reset_password_with_token(p_token_hash text, p_password_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
DECLARE v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM auth_token
  WHERE token_hash=p_token_hash AND purpose='reset_password' AND used_at IS NULL AND expires_at>now() FOR UPDATE;
  IF v_user_id IS NULL THEN RETURN false; END IF;
  UPDATE app_user SET password_hash=p_password_hash,must_change_password=false,failed_login_attempts=0,locked_until=NULL WHERE id=v_user_id AND account_active;
  UPDATE auth_token SET used_at=now() WHERE user_id=v_user_id AND purpose='reset_password' AND used_at IS NULL;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION is_current_user_admin(),admin_list_users(),admin_create_user(varchar,varchar,text),admin_create_reset_token(uuid,text),admin_set_user_active(uuid,boolean),change_own_password(text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='smartbanca_app') THEN
    GRANT EXECUTE ON FUNCTION lookup_login_user(text),is_current_user_admin(),admin_list_users(),admin_create_user(varchar,varchar,text),admin_create_reset_token(uuid,text),admin_set_user_active(uuid,boolean),change_own_password(text),reset_password_with_token(text,text) TO smartbanca_app;
  END IF;
END $$;

COMMIT;

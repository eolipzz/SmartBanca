-- SmartBanca · PostgreSQL 15+
-- Execute as the database owner. The application role must not have BYPASSRLS.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('user', 'support', 'admin');
CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal');
CREATE TYPE bet_status AS ENUM ('pending', 'green_total', 'green_partial', 'red_total', 'red_partial', 'void');

CREATE TABLE app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL CHECK (length(trim(name)) >= 2),
  email varchar(254) NOT NULL,
  password_hash text NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  failed_login_attempts smallint NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX app_user_email_lower_uidx ON app_user (lower(email));

CREATE TABLE bank_transaction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount numeric(16,2) NOT NULL CHECK (amount > 0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  note varchar(200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bank_transaction_user_date_idx ON bank_transaction(user_id, occurred_at DESC);

CREATE TABLE bet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  placed_at timestamptz NOT NULL,
  sport varchar(40) NOT NULL CHECK (length(trim(sport)) >= 2),
  event_market varchar(160),
  stake numeric(16,2) NOT NULL CHECK (stake > 0),
  initial_odd numeric(10,4) NOT NULL CHECK (initial_odd >= 1.01),
  potential_return numeric(16,2) GENERATED ALWAYS AS (round(stake * initial_odd, 2)) STORED,
  status bet_status NOT NULL DEFAULT 'pending',
  effective_return numeric(16,2),
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bet_settlement_consistency CHECK (
    (status = 'pending' AND effective_return IS NULL AND settled_at IS NULL) OR
    (status <> 'pending' AND effective_return IS NOT NULL AND effective_return >= 0 AND settled_at IS NOT NULL)
  ),
  CONSTRAINT bet_return_by_status CHECK (
    status = 'pending' OR
    (status = 'green_total' AND effective_return = round(stake * initial_odd, 2)) OR
    (status = 'green_partial' AND effective_return > stake AND effective_return < round(stake * initial_odd, 2)) OR
    (status = 'red_total' AND effective_return = 0) OR
    (status = 'red_partial' AND effective_return > 0 AND effective_return < stake) OR
    (status = 'void' AND effective_return = stake)
  )
);
CREATE INDEX bet_user_placed_idx ON bet(user_id, placed_at DESC);
CREATE INDEX bet_user_status_idx ON bet(user_id, status);
CREATE INDEX bet_user_sport_idx ON bet(user_id, sport);

CREATE TABLE audit_event (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES app_user(id) ON DELETE SET NULL,
  action varchar(80) NOT NULL,
  entity_type varchar(40),
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_event_user_date_idx ON audit_event(user_id, created_at DESC);

-- Campo opcional de informação pessoal crítica. A chave nunca é persistida no banco;
-- a aplicação deve defini-la por transação em app.field_encryption_key.
CREATE TABLE private_profile (
  user_id uuid PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  encrypted_notes bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.current_user_id', true), '')::uuid $$;

ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_user FORCE ROW LEVEL SECURITY;
ALTER TABLE bank_transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transaction FORCE ROW LEVEL SECURITY;
ALTER TABLE bet ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_event FORCE ROW LEVEL SECURITY;
ALTER TABLE private_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_profile FORCE ROW LEVEL SECURITY;

CREATE POLICY user_self_select ON app_user FOR SELECT USING (id = current_app_user_id());
CREATE POLICY user_self_update ON app_user FOR UPDATE USING (id = current_app_user_id()) WITH CHECK (id = current_app_user_id());
CREATE POLICY user_registration ON app_user FOR INSERT WITH CHECK (role = 'user' AND failed_login_attempts = 0 AND locked_until IS NULL);
CREATE POLICY transaction_isolation ON bank_transaction USING (user_id = current_app_user_id()) WITH CHECK (user_id = current_app_user_id());
CREATE POLICY bet_isolation ON bet USING (user_id = current_app_user_id()) WITH CHECK (user_id = current_app_user_id());
CREATE POLICY audit_read_own ON audit_event FOR SELECT USING (user_id = current_app_user_id());
CREATE POLICY audit_insert_own ON audit_event FOR INSERT WITH CHECK (user_id = current_app_user_id());
CREATE POLICY private_profile_isolation ON private_profile USING (user_id = current_app_user_id()) WITH CHECK (user_id = current_app_user_id());

CREATE OR REPLACE FUNCTION lookup_login_user(p_email text)
RETURNS TABLE(id uuid,name varchar,password_hash text,role user_role,failed_login_attempts smallint,locked_until timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_catalog AS $$
  SELECT u.id,u.name,u.password_hash,u.role,u.failed_login_attempts,u.locked_until
  FROM app_user u WHERE lower(u.email)=lower(p_email) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION save_private_notes(p_notes text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_key text := current_setting('app.field_encryption_key', true);
BEGIN
  IF v_key IS NULL OR length(v_key) < 32 THEN RAISE EXCEPTION 'Chave de criptografia não configurada'; END IF;
  INSERT INTO private_profile(user_id, encrypted_notes) VALUES(current_app_user_id(), pgp_sym_encrypt(p_notes, v_key, 'cipher-algo=aes256'))
  ON CONFLICT(user_id) DO UPDATE SET encrypted_notes=excluded.encrypted_notes,updated_at=now();
END $$;

CREATE OR REPLACE FUNCTION settle_bet(p_bet_id uuid, p_status bet_status, p_effective_return numeric DEFAULT NULL)
RETURNS SETOF bet LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_bet bet;
DECLARE v_return numeric(16,2);
BEGIN
  IF p_status = 'pending' THEN RAISE EXCEPTION 'Status de encerramento inválido'; END IF;
  SELECT * INTO v_bet FROM bet WHERE id = p_bet_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  v_return := CASE p_status WHEN 'green_total' THEN v_bet.potential_return WHEN 'red_total' THEN 0 WHEN 'void' THEN v_bet.stake ELSE p_effective_return END;
  UPDATE bet SET status=p_status,effective_return=v_return,settled_at=now(),updated_at=now() WHERE id=p_bet_id RETURNING * INTO v_bet;
  INSERT INTO audit_event(user_id,action,entity_type,entity_id,metadata) VALUES(v_bet.user_id,'bet.settled','bet',v_bet.id,jsonb_build_object('status',p_status,'return',v_return));
  RETURN NEXT v_bet;
END $$;

CREATE OR REPLACE VIEW financial_summary WITH (security_invoker=true) AS
SELECT u.id AS user_id,
  COALESCE((SELECT sum(CASE WHEN type='deposit' THEN amount ELSE -amount END) FROM bank_transaction t WHERE t.user_id=u.id),0) AS net_cash_flow,
  COALESCE((SELECT sum(CASE WHEN status='pending' THEN stake ELSE 0 END) FROM bet b WHERE b.user_id=u.id),0) AS stakes_held,
  COALESCE((SELECT sum(CASE WHEN status<>'pending' THEN effective_return-stake ELSE 0 END) FROM bet b WHERE b.user_id=u.id),0) AS betting_profit,
  COALESCE((SELECT sum(CASE WHEN type='deposit' THEN amount ELSE -amount END) FROM bank_transaction t WHERE t.user_id=u.id),0)
    + COALESCE((SELECT sum(CASE WHEN status<>'pending' THEN effective_return-stake ELSE 0 END) - sum(CASE WHEN status='pending' THEN stake ELSE 0 END) FROM bet b WHERE b.user_id=u.id),0) AS current_bank
FROM app_user u;

COMMIT;

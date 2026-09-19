-- Execute after schema.sql for a local demo account. Password: DemoSmartBanca2026!
INSERT INTO app_user (id, name, email, password_hash)
VALUES ('11111111-1111-4111-8111-111111111111', 'Matheus Barbosa', 'demo@smartbanca.local', '$2b$12$TpwJP3iKdzsOhZ7LzMYQe.IbHvA0v/CfRlozYYLXnQlrJ8D8mB4mK')
ON CONFLICT DO NOTHING;

SELECT set_config('app.current_user_id', '11111111-1111-4111-8111-111111111111', false);
INSERT INTO bank_transaction(user_id,type,amount,note) VALUES
('11111111-1111-4111-8111-111111111111','deposit',6500,'Capital inicial');

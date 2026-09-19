# SmartBanca

Plataforma full-stack para gestão de banca esportiva, construída com Next.js, TypeScript e PostgreSQL. Na ausência de um servidor PostgreSQL, o painel entra automaticamente em modo local e persiste apostas e movimentações no navegador para que todos os fluxos possam ser usados imediatamente.

## Executar no VS Code

1. Instale Node.js 20+ e PostgreSQL 15+.
2. Copie `.env.example` para `.env.local` e troque todos os segredos.
3. Crie o banco, execute `database/schema.sql` uma vez e rode `npm run db:migrate`.
4. Rode `npm install` e depois `npm run dev`.
5. Abra `http://localhost:3000`.

## Contas e perfil

O acesso ao painel exige cadastro ou login. Cada conta nova começa com banca, apostas e movimentações zeradas. O usuário pode alterar o nome e enviar uma foto JPG, PNG ou WebP de até 2 MB pelo painel de perfil; a imagem fica armazenada no PostgreSQL e isolada pelas políticas RLS.

## Modelo financeiro

- Depósito aumenta saldo e capital próprio; saque reduz ambos.
- A stake de uma aposta pendente fica retida.
- Resultado de aposta = retorno efetivo menos stake.
- Green/red total, cashout positivo/negativo e void são validados no banco.

## Segurança

- Sessão JWT em cookie `HttpOnly`, `Secure` em produção e `SameSite=Strict`.
- Senhas bcrypt com custo 12, bloqueio após cinco falhas e rate limit de autenticação.
- Queries parametrizadas, validação Zod e respostas sem stack trace.
- RLS forçado em todas as tabelas privadas; cada transação define `app.current_user_id` localmente.
- CSP e cabeçalhos de proteção configurados em `next.config.ts`.

O rate limit é persistido no PostgreSQL e funciona entre múltiplas instâncias. Em produção, configure HTTPS, TLS no PostgreSQL, `RESEND_API_KEY`, `EMAIL_FROM` e um `NEXT_PUBLIC_APP_URL` público.

## Operação

- `npm test`: valida as regras financeiras essenciais.
- `npm run db:backup`: gera um backup restaurável em `backups/`.
- CSV e PDF podem ser baixados na área **Movimentações recentes**.
- Alterações financeiras geram eventos de auditoria no banco.
- Antes de uma publicação, rode `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

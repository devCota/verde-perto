# Deploy para apresentação

A aplicação funciona localmente sem contas externas. Nenhum serviço foi criado ou publicado. Esta configuração usa Angular no Cloudflare Pages, FastAPI no Render e PostgreSQL/Storage no Supabase. Confira as condições dos planos no momento de criar as contas.

## Limites consultados em 24/10/2026

- O [Render Free](https://render.com/docs/free) suspende a API após 15 minutos sem tráfego; a primeira requisição pode levar cerca de um minuto. O disco é temporário e não serve para SQLite ou uploads persistentes. O plano concede 750 horas por workspace/mês. Seu PostgreSQL gratuito expira em 30 dias, portanto a proposta usa um banco externo.
- O [Supabase Free](https://supabase.com/docs/guides/platform/billing-on-supabase) inclui 500 MB de banco por projeto e 1 GB de armazenamento. [Projetos de baixa atividade podem ser pausados após sete dias](https://supabase.com/docs/guides/platform/free-project-pausing). Confirme limites de tráfego, armazenamento e condições no painel antes da apresentação.
- O [Cloudflare Pages Free](https://developers.cloudflare.com/pages/platform/limits/) tem cotas de builds e arquivos; a função `/api` também usa as [cotas de Functions/Workers](https://developers.cloudflare.com/pages/functions/pricing/). Hospedagem gratuita não significa recursos ilimitados.

## 1. PostgreSQL e imagens no Supabase

1. Crie manualmente um projeto no plano escolhido. Copie a conexão PostgreSQL oferecida em Connect; para servidores sem IPv6, use o pooler em modo **session**, conforme o painel. Use `sslmode=require`.
2. No Storage, crie um bucket público chamado `offers`, com limite de arquivo de 5 MB e MIME `image/jpeg`. As imagens de oferta são públicas por definição; nunca envie documentos ou fotos com informação pessoal. O servidor reencodifica e remove EXIF antes de enviar.
3. Reserve `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` apenas para o backend. A chave administrativa não vai para Angular, Pages, Git, screenshots ou logs.
4. O frontend nunca consulta tabelas diretamente. Desabilite a exposição das tabelas da aplicação pela Data API no Supabase, ou habilite RLS sem políticas públicas nelas. Somente o backend com a conexão PostgreSQL deve acessá-las. Não crie políticas públicas para usuários, sessões ou mensagens.

## 2. FastAPI no Render

Crie um Web Service Python a partir do repositório. `render.yaml` fornece a configuração, mas não cria recursos por si só. Selecione explicitamente Free e configure:

- Root directory: `backend`.
- Build: `pip install -r requirements.txt`.
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers`.
- Health: `/api/health`.
- `ENVIRONMENT=production`.
- `DATABASE_URL=postgresql+psycopg://...?...` (use a string do painel, com SSL).
- `CORS_ORIGINS=["https://SEU-PROJETO.pages.dev"]`.
- `SUPABASE_URL=https://SEU-PROJETO.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY`: segredo fornecido pelo painel.
- `STORAGE_BUCKET=offers`.

O início cria as tabelas vazias. Não configure seed como comando de inicialização. Para uma demonstração pública explicitamente autorizada, o seed exige `ALLOW_DEMO_SEED=true` em produção e execução manual. Nunca use as contas fictícias como contas administrativas.

## 3. Angular no Cloudflare Pages

Conecte o repositório e configure:

- Root directory: `frontend`.
- Build command: `npm ci && npm run build`.
- Output directory: `dist/verdeperto/browser`.
- Node.js: 26 (ou outra versão compatível com Angular 22).
- Variável de **runtime da Function**: `API_ORIGIN=https://SUA-API.onrender.com`.

`frontend/functions/api/[[path]].js` encaminha `/api/*` ao Render. Ele preserva o cookie HttpOnly no domínio do Angular; `Secure` é ativado pelo backend em produção. Não aponte o Angular diretamente para outro domínio: isso exigiria rever SameSite, CSRF e autenticação entre origens. `_redirects` fornece fallback de SPA para links como `/ofertas/1`.

Após criar o domínio final, atualize `CORS_ORIGINS` no Render. Para domínio próprio, inclua apenas as origens realmente usadas.

## 4. Validar e atualizar

Verifique cadastro, login, upload, favoritos, chat entre duas pessoas, atualização de disponibilidade e acesso por link direto. Reinicie a API e confirme que anúncios e imagens continuam presentes. Abra o mapa e confira a atribuição OpenStreetMap. A primeira chamada ao Render pode precisar de espera devido à suspensão do plano.

Atualizações de código seguem commit/push pelo responsável e rebuild das plataformas. Alterações de esquema exigem migração planejada antes de publicar; `create_all` não altera tabelas existentes. Faça backup do banco e das imagens antes dessas mudanças.

## Limite de verificação desta entrega

Integração local com SQLite e uploads em disco foi exercitada. Conexão real PostgreSQL, bucket externo e publicação dependem das contas e credenciais do responsável; não foram simuladas como deploy concluído.

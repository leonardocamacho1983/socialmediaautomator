# Social Media Automator

Painel Next.js para criar rascunhos, aprovar, agendar e publicar posts no Instagram e LinkedIn usando a API da Zernio.

Também inclui a fundação de persistência no Supabase para calendário editorial, drafts gerados, assets de mídia e histórico de webhooks.

## Variáveis

Configure na Vercel:

```env
ZERNIO_API_KEY=sk_...
ADMIN_PASSWORD=uma-senha-longa
ZERNIO_WEBHOOK_SECRET=obrigatorio-em-producao
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Nunca coloque `ZERNIO_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ou qualquer secret no browser, no prompt ou no GitHub. Variáveis `NEXT_PUBLIC_*` são públicas por definição.

## Rodar localmente

```bash
npm install
npx vercel env pull .env.local --environment=production --yes
npm run dev
```

Abra `http://localhost:3000`.

## Zernio

Endpoints usados:

- `GET /v1/accounts`
- `GET /v1/posts`
- `POST /v1/posts`
- `GET /v1/posts/{postId}`
- `PUT /v1/posts/{postId}`
- `DELETE /v1/posts/{postId}`

Webhook público:

- `POST /api/webhooks/zernio`
- `GET /api/webhooks/zernio/self-test` para testar o webhook logado como admin

Se configurar `ZERNIO_WEBHOOK_SECRET`, o app valida `X-Zernio-Signature` com HMAC-SHA256 sobre o corpo bruto da request.

## Supabase

Schema aplicado:

- `brand_profiles`
- `personas`
- `content_pillars`
- `content_calendar_items`
- `media_assets`
- `post_drafts`
- `generation_runs`
- `zernio_events`

Todas as tabelas têm RLS habilitado. O app acessa o banco apenas no servidor via `SUPABASE_SERVICE_ROLE_KEY`.

Endpoint interno:

- `GET /api/editorial/status`

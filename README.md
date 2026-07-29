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
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
PEXELS_API_KEY=...
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
- `brand_assets`
- `post_drafts`
- `generation_runs`
- `zernio_events`

Todas as tabelas têm RLS habilitado. O app acessa o banco apenas no servidor via `SUPABASE_SERVICE_ROLE_KEY`.

Endpoint interno:

- `GET /api/editorial/status`

## Gerador editorial

O dashboard inclui um formulário para gerar calendário e drafts a partir do briefing do negócio.

- Com `GROQ_API_KEY`, o app usa Groq Chat Completions em modo JSON.
- Sem `GROQ_API_KEY`, o app usa fallback determinístico para validar o fluxo.
- Com `PEXELS_API_KEY`, o app busca uma mídia sugerida por draft e salva em `media_assets`.
- Sem `PEXELS_API_KEY`, os drafts são criados sem mídia automática.

Nada é publicado automaticamente. Os drafts ficam no Supabase para revisão humana antes de envio à Zernio.

## Assets da marca

O dashboard permite subir assets proprietários para um bucket privado do Supabase Storage:

- logos
- fotos
- produto
- screenshots
- templates
- fundos
- referências visuais

Os metadados ficam em `brand_assets`; os arquivos ficam no bucket privado `brand-assets`. O bucket é criado automaticamente no primeiro upload se ainda não existir.

Arquivos HTML do design system também são aceitos no upload (`.html`/`.htm`), assim como pacotes `.zip`.

Para design systems publicados como URL, use o formulário "Adicionar link":

- design system
- brand book
- Figma
- Canva
- landing page
- site
- referência externa

Esses links ficam em `brand_references`.

Assets e referências podem ser deletados pelo dashboard. No caso de asset enviado, o app remove o arquivo do Supabase Storage e depois remove o registro em `brand_assets`.

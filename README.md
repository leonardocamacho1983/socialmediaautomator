# Social Media Automator

Painel Next.js para criar rascunhos, aprovar, agendar e publicar posts no Instagram e LinkedIn usando a API da Zernio.

## Variáveis

Configure na Vercel:

```env
ZERNIO_API_KEY=sk_...
ADMIN_PASSWORD=uma-senha-longa
ZERNIO_WEBHOOK_SECRET=opcional
```

Nunca coloque `ZERNIO_API_KEY` no browser, no prompt ou no GitHub.

## Rodar localmente

```bash
npm install
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

Se configurar `ZERNIO_WEBHOOK_SECRET`, o app valida `X-Zernio-Signature` com HMAC-SHA256 sobre o corpo bruto da request.

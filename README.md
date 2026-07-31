# Social Creative OS

Sistema interno Next.js para inteligencia editorial, producao criativa, publicacao e engajamento social, com foco inicial em Instagram e integracao Zernio.

A reconstrucao controlada comecou em 2026-07-30 na branch `rebuild/creative-os-phase-1`. A versao funcional anterior foi preservada na branch local `backup/pre-creative-os-rebuild-20260730`.

O plano completo de inventario, migracao, nova arquitetura, riscos e backlog esta em `docs/architecture/rebuild-plan.md`.

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

Se o app local redirecionar para `/setup`, falta `ADMIN_PASSWORD` no `.env.local`.
Em produção, as páginas internas devem redirecionar para `/login` quando não há
sessão ativa.

## Páginas do Social Creative OS

Novas rotas da arquitetura:

- `/` - cockpit Social Creative OS
- `/estrategia` - Business Profile, Brand DNA, perfil de escrita, audiencia e estrategia
- `/campanhas` - campanhas, narrativas, funil, hipoteses e decision policy
- `/conceitos` - creative concepts, creative pieces, variants e quality gates
- `/producao` - visual grammar, layout spec, rendering jobs e rendered assets
- `/engajamento` - comentarios, DMs, keyword-to-DM, contatos, conversas e escalonamento
- `/aprendizado` - performance, insights e learning loop

Rotas legadas preservadas:

- `/marca` - assets, links, design system e analise da marca
- `/ideias` - geracao e curadoria de ideias legadas
- `/criacao` - previews e drafts legados
- `/publicacao` - criacao manual, agendamento e publicacao via Zernio
- `/sistema` - webhooks, posts sincronizados e operacao tecnica

O fluxo novo e: estrategia -> campanha -> conceito criativo -> variante -> renderizacao -> publicacao -> engajamento -> aprendizado.

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

Schema legado preservado:

- `brand_profiles`
- `personas`
- `content_pillars`
- `content_calendar_items`
- `media_assets`
- `brand_assets`
- `post_drafts`
- `generation_runs`
- `zernio_events`

Schema novo da fase 1:

- `business_profiles`
- `brand_dna`
- `brand_writing_profiles`
- `brand_visual_systems`
- `audience_segments`
- `content_strategies`
- `campaigns`
- `creative_concepts`
- `creative_pieces`
- `creative_variants`
- `copy_evaluations`
- `creative_evaluations`
- `rendering_jobs`
- `rendered_assets`
- `publication_jobs`
- `engagement_policies`
- `contacts`
- `conversations`
- `social_interactions`
- `engagement_actions`
- `content_performance`
- `learning_insights`
- `decision_traces`

Todas as tabelas têm RLS habilitado. O app acessa o banco apenas no servidor via `SUPABASE_SERVICE_ROLE_KEY`.

Endpoint interno:

- `GET /api/editorial/status`

O cockpit novo usa leitura server-side de status via `lib/social-os/foundation-store.ts`.

## Gerador editorial

O dashboard agora separa a criação em duas etapas:

1. gerar ideias para curadoria
2. gerar drafts/previews

- Com `GROQ_API_KEY`, o app usa Groq Chat Completions em modo JSON.
- Sem `GROQ_API_KEY`, o app usa fallback determinístico para validar o fluxo.
- Com `PEXELS_API_KEY`, o app busca uma mídia sugerida por draft e salva em `media_assets`.
- Sem `PEXELS_API_KEY`, os drafts são criados sem mídia automática.

Nada é publicado automaticamente. Os drafts ficam no Supabase para revisão humana antes de envio à Zernio.

Ideias ficam em `content_ideas` com status `generated`, `approved`, `rejected`, `expanded` ou `archived`.

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

Ao subir um `.zip`, o app descompacta o pacote e salva cada arquivo interno aceito como um asset separado. Limites:

- até 50MB por upload
- até 100 arquivos úteis dentro do ZIP
- aceita imagens, vídeos, PDF e HTML
- ignora arquivos de sistema, caminhos inseguros e formatos desconhecidos

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

## Conhecimento da marca

Depois de subir assets ou links, use o botão "Analisar marca" no dashboard.

Essa análise:

- lê inventário de `brand_assets` e `brand_references`
- baixa HTML/SVG do bucket privado quando possível
- extrai texto útil de HTML
- extrai cores prováveis de HTML/SVG
- reclassifica assets por nome quando detecta logo, símbolo, favicon, avatar, template etc.
- salva um resumo em `brand_knowledge`
- injeta esse resumo no prompt do gerador editorial

Sem essa etapa, o gerador usa apenas o campo manual "Design system / tom visual".

## Fase 1: motores internos

A primeira fase adiciona modulos separados em `lib/social-os/`:

- `decision-policy.ts` - decisao de formato, estilo de copy, CTA, automacao e revisao humana
- `human-writing.ts` - detector de padroes artificiais e prompt de reescrita adversarial
- `creative-direction.ts` - creative concept seed e contrato de direcao criativa
- `visual-grammar.ts` - gramaticas visuais e layout spec
- `engagement-policy.ts` - classificacao inicial de comentarios e preparacao de acoes
- `rendering.ts` - plano de renderizacao server-side sem Open Design
- `foundation-store.ts` - status e bootstrap da fundacao no Supabase

## Validacao local

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

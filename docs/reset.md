# Marco 0 Reset

Date: 2026-07-31

## Archive

The previous application was archived before the reset.

- Branch: `archive/socialmediaautomator-v1`
- Tag: `archive/socialmediaautomator-v1`
- Remote: `https://github.com/leonardocamacho1983/socialmediaautomator.git`

The archive includes the previous production code and the uncommitted rebuild
attempt that was present in the local worktree before the reset.

## Removed

The reset removed the previous app implementation:

- legacy pages and routes, including `/marca`, `/ideias`, `/criacao`,
  `/publicacao`, `/sistema`, `/setup`, and `/login`;
- legacy API routes for accounts, posts, editorial status, and Zernio webhooks;
- legacy modules for auth, Supabase, Zernio, Groq, Pexels, forms, and editorial
  storage;
- legacy prompts, entities, product flows, UX, and architecture;
- Supabase migrations from the previous application;
- old README and generated V0 helper file.

## Preserved

The reset preserved the external infrastructure boundary:

- the same GitHub repository;
- the same local Vercel project link in `.vercel`;
- the `vercel.json` deployment contract for a Next.js build;
- environment variable names only, with no secret values committed;
- ignored local `.env*` files.

Marco 0 does not use Supabase, Zernio, Groq, Recraft, Pexels, or the Vercel AI
Gateway yet. Their variable names are kept only so future milestones can wire
them intentionally.

## New Structure

```text
app/
  api/
    health/
      route.ts
  globals.css
  layout.tsx
  page.tsx
docs/
  reset.md
README.md
.env.example
eslint.config.mjs
next.config.ts
package-lock.json
package.json
tsconfig.json
vercel.json
```

## Run Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Validate Locally

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The health check should return JSON at:

```text
/api/health
```

Expected shape:

```json
{
  "status": "ok",
  "service": "socialmediaautomator",
  "milestone": "marco-0-reset",
  "productFeaturesEnabled": false
}
```

## Validate Deploy

After the local build passes, deploy with the existing Vercel project link:

```bash
vercel deploy -y
```

Then open the deployment URL and `/api/health` on that same deployment.

## Next Milestones

Do not start these in Marco 0.

1. Marco 1: Brand foundation.
2. Marco 2: Creative concept generator.
3. Marco 3: First typographic post.
4. Marco 4: Asset generation.
5. Marco 5: Carousels.
6. Marco 6: Copy quality gate.

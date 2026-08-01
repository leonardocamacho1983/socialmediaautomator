# Marco 3.1 Caption Workshop

Date: 2026-08-01

## Scope

Marco 3.1 adds caption generation after a selected typographic post exists at
`/create`.

Included:

- requires a selected creative concept;
- requires a generated typographic piece;
- sends brand context, briefing, selected concept, and final visual copy to the
  caption route;
- generates exactly three caption variants;
- keeps the caption complementary to the visual copy instead of repeating the
  card;
- returns first comment, hashtags, and an Instagram performance review for each
  variant;
- lets the user select a variant;
- lets the user edit caption, first comment, and hashtags;
- runs a local review against clarity, comment potential, share potential,
  save potential, brand fit, AI-like copy risk, and overpromise risk;
- copies the selected caption package to the clipboard;
- persists the caption package in browser `localStorage` with the current
  creative project.

Not included:

- Recraft or image generation;
- carousels;
- Supabase persistence;
- Zernio;
- scheduling or publishing;
- analytics;
- comment or DM automation.

## AI Gateway

The API route is:

```text
POST /api/captions
```

It uses the AI SDK through the Vercel AI Gateway:

```text
generateText -> JSON extraction -> Zod validation -> caption package
```

Default model:

```text
anthropic/claude-sonnet-5
```

Fallback model:

```text
openai/gpt-5.4-mini
```

Override with:

```text
CAPTION_MODEL=
CAPTION_FALLBACK_MODEL=
```

## Validation

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Then validate `/create` with a selected concept and typographic piece:

1. Click `Gerar legenda`.
2. Confirm three variants appear.
3. Select each variant.
4. Edit the caption, first comment, and hashtags.
5. Click `Revisar para Instagram`.
6. Confirm the review changes after editing.
7. Click `Copiar legenda`.

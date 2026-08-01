# Marco 3 Typographic Post Workshop

Date: 2026-08-01

## Scope

Marco 3 turns the selected creative concept into the first typographic
Instagram asset at `/create`.

Included:

- requires a selected Marco 2 concept;
- creates visual copy from the selected concept and briefing;
- avoids using raw briefing text as public visual copy;
- strips internal production metadata from rendered assets;
- produces a 1080x1350 typographic post specification;
- renders three deterministic layout variations;
- lets the user edit headline, support copy, and visual CTA after generation;
- lets the user add an optional instruction before regenerating the
  typographic piece;
- applies the current brand colors, typography settings, and logo when present;
- lets the user choose one variation;
- previews the selected variation in 4:5 format;
- exports the selected variation as a PNG from the browser;
- persists the generated piece and selected variation in browser `localStorage`.

Not included:

- Recraft or image generation;
- stock media;
- carousel generation;
- video or Reels;
- publishing caption workflow, documented separately in
  `docs/caption-generation.md`;
- Supabase persistence;
- Zernio;
- scheduling or publishing;
- analytics;
- engagement automation.

## Rendering Model

The AI model does not render the final image.

The flow is:

```text
selected concept
  -> typographic copy
  -> layout variation spec
  -> SVG 1080x1350
  -> browser PNG export
```

The PNG export is client-side and does not call external APIs.

## Validation

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Then validate `/create` with a selected concept:

1. Click `Produzir peca tipografica`.
2. Confirm the 4:5 preview appears.
3. Edit headline, support copy, or CTA.
4. Confirm the preview updates.
5. Add an optional instruction in `Direcao para regenerar`.
6. Click `Regenerar peca`.
7. Confirm the copy and selected variation respond to the instruction.
8. Select each variation.
9. Click `Baixar PNG`.
10. Confirm a PNG download is created.

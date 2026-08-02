# Marco 3.2 Final Post Package

Date: 2026-08-02

## Scope

Marco 3.2 closes the first publishable typographic post flow at `/create`.

Included:

- requires a selected creative concept;
- requires a generated typographic piece;
- requires a generated caption package;
- shows the selected image, caption, first comment, and hashtags together;
- provides a final quality checklist;
- lets the user approve or reapprove the final package;
- stores the approval state in browser `localStorage`;
- invalidates the approval when the visual piece, caption, first comment,
  hashtags, or review changes;
- exports the selected image as PNG;
- copies the caption, first comment, or full post package to the clipboard.

Not included:

- Recraft or image generation;
- carousels;
- Supabase persistence;
- Zernio;
- scheduling or publishing;
- analytics;
- comment or DM automation.

## Final Package Contract

The approved package records:

```text
concept id
typographic piece id
typographic variant id
caption package id
caption variant id
approval timestamp
quality checklist snapshot
```

This is still local browser state. It is intentionally not a production content
database yet.

## Validation

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Then validate `/create` with a selected concept, typographic piece, and caption:

1. Confirm `Pacote final do post` appears after the caption workshop.
2. Confirm the selected image, caption, first comment, and hashtags appear
   together.
3. Click `Aprovar pacote final`.
4. Confirm the state changes to `Post aprovado`.
5. Copy the caption, first comment, and full package.
6. Click `Baixar PNG`.
7. Edit the caption or visual copy.
8. Confirm the final approval is cleared.

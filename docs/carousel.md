# Marco 5 Deterministic Carousel

Date: 2026-08-02

## Scope

Marco 5 adds the first carousel package to approved post details. The carousel
is generated from the approved brand snapshot, selected concept, typographic
piece, and selected caption. It does not call a new model.

Included:

- carousel controls in `/approved/[postId]`;
- six 1080x1350 slides;
- cover, scene, tension, mechanism, proof, and close slide roles;
- public slide copy generated separately from internal concept notes;
- internal purpose kept out of the rendered slide text;
- Portuguese spelling and accent quality gate for common carousel output;
- weak CTA guard against awkward questions such as `qual e o seu caso hoje`;
- quality gate against briefing language such as `metafora`, `virada`,
  `fecho`, `mostrar que`, `estrutura narrativa`, and `direcao visual`;
- brand colors and font choices from the local brand profile;
- browser-local persistence in `socialmediaautomator.approvedPosts.v1`;
- slide previews in the approved post detail page;
- manual editing for eyebrow, headline, supporting copy, and footer per slide;
- single-slide regeneration without rebuilding the whole carousel;
- controlled copy variations so regenerating does not recreate identical slides;
- persistent carousel generation index, preserved even after deleting a
  carousel;
- deterministic visual grammars by slide role:
  - cover texture with brand-framed typographic hierarchy;
  - scene visual with chat bubbles;
  - tension visual with timer and compression bars;
  - mechanism visual with handoff/flow structure;
  - proof visual with contrast between wrong and right patterns;
  - close visual with CTA mark;
- carousel approval state before export;
- copy alerts for briefing language, weak patterns, and common Portuguese
  issues;
- ZIP export with six PNGs, caption, first comment, hashtags, script, and
  metadata, only after carousel approval;
- inclusion in the final post ZIP when the carousel is approved before the
  final package is downloaded;
- delete, regenerate, approve, and export controls;
- local carousel event history.

Not included:

- AI-generated carousel script;
- Recraft;
- image generation inside slides;
- durable storage;
- publishing;
- scheduling;
- analytics;
- Zernio;
- Reels or video.

## Data Contract

Approved post records now include:

```ts
carouselPackage: CarouselPackage | null
carouselStatus: "draft" | "approved"
carouselApprovedAt: string | null
carouselEvents: ApprovedPostCarouselEvent[]
carouselGenerationIndex: number
```

The current renderer is:

```text
deterministic-carousel-v3
```

Older `deterministic-carousel-v1` and `deterministic-carousel-v2` packages are
intentionally treated as stale. Generate the carousel again to replace
briefing-like, unaccented, or weak slide copy with public copy.

The package is intentionally browser-local for now. This keeps the milestone
focused on whether the approved post can become a useful sequence before adding
database persistence or automation.

Editing or regenerating a slide returns the carousel to `draft`. The ZIP remains
blocked until the carousel is approved again. This avoids exporting a sequence
that has not been reviewed after copy changes.

Carousel generation is still deterministic, but no longer identical on every
click. Each whole-carousel generation uses the next controlled variation. Each
single-slide regeneration also advances the variation for that slide. Deleting a
carousel does not reset `carouselGenerationIndex`, so deleting and generating
again produces the next variation instead of recreating the same package.

The visual layer is also deterministic. The renderer chooses visual grammar by
slide role instead of asking a model to create final art. This keeps text,
layout, colors, and visual symbols editable/predictable while making the
carousel feel less like a plain typographic deck.

## Validation

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Manual validation:

1. Open an approved post detail page.
2. Click `Gerar carrossel`.
3. Confirm six slides appear.
4. Edit one slide headline and click `Salvar slide`.
5. Confirm the preview updates and the carousel status remains in review.
6. Click `Regenerar slide` on one slide and confirm only that slide changes.
7. Click `Apagar carrossel`, generate again, and confirm the new carousel is
   not identical to the deleted one.
8. Confirm body slides have different visual grammar by role, not only text:
   chat bubbles, timer/bars, flow, proof contrast, and final CTA mark.
9. Confirm the visuals do not overlap with headline, body, footer, brand, or
   slide count.
10. Confirm the slide text does not include internal words like `metafora`,
   `virada`, `fecho`, or `mostrar que`.
11. Confirm common Portuguese words are accented, for example `não`, `você`,
   `está`, `também`, `negócio`, `robô`, `ninguém`, and `já`.
12. Confirm the final slide uses a natural question, not a long awkward prompt.
13. Confirm `Baixar ZIP do carrossel` is blocked before approval.
14. Click `Aprovar carrossel`.
15. Click `Baixar ZIP do carrossel`.
16. Confirm the ZIP includes `slides/slide-01.png` through
   `slides/slide-06.png`, copy files, `roteiro.txt`, and `metadata.json`.
17. Click `Apagar carrossel` and confirm the empty state returns.

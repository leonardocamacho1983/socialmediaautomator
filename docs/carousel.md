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
- quality gate against briefing language such as `metafora`, `virada`,
  `fecho`, `mostrar que`, `estrutura narrativa`, and `direcao visual`;
- brand colors and font choices from the local brand profile;
- browser-local persistence in `socialmediaautomator.approvedPosts.v1`;
- slide previews in the approved post detail page;
- ZIP export with six PNGs, caption, first comment, hashtags, script, and
  metadata;
- delete and regenerate controls.

Not included:

- AI-generated carousel script;
- Recraft;
- image generation inside slides;
- manual slide editor;
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
```

The current renderer is:

```text
deterministic-carousel-v2
```

Older `deterministic-carousel-v1` packages are intentionally treated as stale.
Generate the carousel again to replace briefing-like slide copy with public
copy.

The package is intentionally browser-local for now. This keeps the milestone
focused on whether the approved post can become a useful sequence before adding
database persistence or automation.

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
4. Confirm the slide text does not include internal words like `metafora`,
   `virada`, `fecho`, or `mostrar que`.
5. Click `Baixar ZIP do carrossel`.
6. Confirm the ZIP includes `slides/slide-01.png` through
   `slides/slide-06.png`, copy files, `roteiro.txt`, and `metadata.json`.
7. Click `Apagar carrossel` and confirm the empty state returns.

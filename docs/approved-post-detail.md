# Marco 6 Approved Post Detail

Date: 2026-08-02

## Scope

Marco 6 keeps the individual review page for each locally approved post, keeps
the deterministic carousel package from Marco 5, and adds a copy quality gate
before package finalization.

Included:

- route `/approved/[postId]`;
- large preview of the approved typographic composition;
- selected caption, first comment, hashtags, and final checklist;
- operational status selector;
- internal notes saved in the local approved post record;
- copy actions for caption, comment, hashtags, and full package;
- export selected image as PNG;
- reopen the approved package in `/create`;
- duplicate the package into a new editable project.
- generate visual assets for the approved post through `/api/assets`;
- select one generated asset;
- preview and download a 1080x1350 composition with the selected asset;
- choose between image-led composition variants;
- reject weak assets with a reason;
- prepare regeneration instructions from the rejection reason;
- approve the final visual version explicitly or through package finalization;
- delete generated assets;
- finalize the post package;
- download a ZIP with final PNG, copy, metadata, and visual history;
- show the visual event history.
- generate a six-slide 1080x1350 carousel package;
- preview each carousel slide in the detail page;
- download a ZIP with carousel PNGs, script, copy, and metadata;
- delete and regenerate the carousel package.
- review visual copy, caption, first comment, hashtags, and carousel slide copy;
- block final package approval while copy blockers remain;
- apply safe deterministic copy fixes for accents, spacing, repeated
  punctuation, and dashes.

Not included:

- Supabase persistence;
- Zernio;
- scheduling or publishing;
- analytics;
- comment or DM automation;
- Reels or video.

## Local Storage Contract

The detail page reads and writes the same local storage collection used by the
approved posts library:

```text
socialmediaautomator.approvedPosts.v1
```

Marco 3.4 adds `notes` to approved post records. Older records without `notes`
are normalized to an empty string when read.

Marco 4.0 adds `generatedAssets` and `selectedVisualAssetId`. Marco 4.1 adds
`selectedAssetCompositionId`, `visualStatus`, `visualApprovedAt`, and
`visualAssetRejections`. Marco 4.2 adds `visualEvents`,
`finalPackageStatus`, and `finalPackageReadyAt`. Marco 5 adds
`carouselPackage`. Marco 6 does not add a new storage field; it derives the
quality report from the current stored copy. Older records without asset fields
are normalized to an empty asset list, no selected asset, the default
composition, typographic-only visual status, empty visual history, package
status open, and no carousel package.

This is still browser-local state. It is not a durable production content
database.

## Validation

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Manual validation:

1. Approve a package in `/create`.
2. Open `/approved`.
3. Click `Detalhes`.
4. Confirm the detail page shows image, caption, first comment, hashtags, and
   checklist.
5. Change status and confirm the status updates.
6. Add internal notes and save.
7. Return to `/approved`, reopen the detail page, and confirm notes persist.
8. Use `Editar no fluxo` and confirm the approved package opens in `/create`.
9. Use `Duplicar` and confirm a new editable project is created without final
   approval.
10. Finalize the package and confirm the current visual is approved
    automatically if it was not approved before.
11. Download the ZIP and confirm it includes final image, copy files, metadata,
    and visual history.
12. Generate the carousel and confirm six slide previews appear.
13. Download the carousel ZIP and confirm it includes six PNG slides, copy,
    script, and metadata.
14. Confirm the `Quality Gate de Copy` panel appears after the final package
    section.
15. Add a copy issue such as `Nao e robo — transforme sua jornada`.
16. Confirm package finalization is blocked while blocker issues remain.
17. Click `Corrigir copy` and confirm only safe fixes are applied.

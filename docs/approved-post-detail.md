# Marco 4.1 Approved Post Detail

Date: 2026-08-02

## Scope

Marco 4.1 keeps the individual review page for each locally approved post and
adds final visual review controls.

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
- approve the final visual version.

Not included:

- Supabase persistence;
- Zernio;
- scheduling or publishing;
- analytics;
- comment or DM automation;
- carousels.

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
`visualAssetRejections`. Older records without asset fields are normalized to an
empty asset list, no selected asset, the default composition, and
typographic-only visual status.

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

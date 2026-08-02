# Marco 4.2 Final Package Export

Date: 2026-08-02

## Scope

Marco 4.2 extends the visual asset step after a final post package has been
approved. The goal is no longer only generating one image: the approved post
detail now supports reviewing, rejecting, regenerating, composing, approving,
finalizing, and exporting the complete post package.

Included:

- API route `/api/assets`;
- Recraft image generation through Vercel AI Gateway;
- default model `recraft/recraft-v4.1`;
- fallback model `openai/gpt-image-1-mini` when the primary image provider
  fails;
- optional override through `VISUAL_ASSET_MODEL`;
- optional override through `VISUAL_ASSET_FALLBACK_MODEL`;
- asset prompt field in `/approved/[postId]`;
- one generated asset per request, with repeated requests accumulating options;
- generated asset options stored in the local approved post record;
- selected asset attached to the approved post;
- three 1080x1350 image-led composition variants;
- PNG download of the selected asset composition;
- quick regeneration instructions before calling the image model again;
- rejection reasons for generated assets;
- undo for accidental asset rejection;
- automatic regeneration prompt from the rejection reason;
- final visual approval status;
- visual status shown in `/approved`;
- final package status shown in `/approved`;
- visual event history for generation, selection, rejection, restoration,
  deletion, visual approval, and package finalization;
- delete generated assets from a post;
- final package ZIP export with PNG, copy, prompt, metadata, and visual history.

The model prompt explicitly asks for visual-only output. Text, letters, logos,
captions, watermarks, and UI labels must stay out of the generated image because
the app renders copy and brand elements itself.

The image-led renderer uses its own composition rules. It keeps the generated
asset as the visual subject and applies brand name, headline, support copy, and
CTA through the system renderer. The current composition families are:

- `lower-panel`: dark lower panel with strong readability;
- `editorial-split`: vertical editorial panel beside the visual subject;
- `clean-band`: light reading band over a dominant image.

The renderer should not duplicate the brand name in the footer, leave support
copy and CTA floating over the image, or depend on text generated inside the
asset.

## Not Included

- Supabase persistence;
- Vercel Blob or durable asset storage;
- Recraft direct API;
- background removal;
- inpainting;
- vector generation;
- carousels;
- video;
- Zernio;
- scheduling or publishing;
- analytics;
- engagement automation.

## Environment

Required for deployed generation:

```text
AI_GATEWAY_API_KEY
```

Optional:

```text
VISUAL_ASSET_MODEL
```

Local development can also use a Vercel OIDC token pulled by the Vercel CLI.
The route returns a clear configuration error when no Gateway credential is
available.

## Local Storage Contract

Marco 4.2 extends approved post records in:

```text
socialmediaautomator.approvedPosts.v1
```

New fields:

```ts
generatedAssets: GeneratedVisualAsset[]
selectedVisualAssetId: string | null
selectedAssetCompositionId: AssetCompositionVariantId
visualStatus: ApprovedPostVisualStatus
visualApprovedAt: string | null
visualAssetRejections: VisualAssetRejection[]
visualEvents: ApprovedPostVisualEvent[]
finalPackageStatus: ApprovedPostFinalPackageStatus
finalPackageReadyAt: string | null
```

The assets are currently stored as data URLs in browser localStorage and capped
to the latest 8 images per post. This is acceptable for the current internal
preview, but not for durable production storage.

## Validation

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Manual validation:

1. Approve a final package in `/create`.
2. Open `/approved`.
3. Open a post detail page.
4. Write or use the suggested asset direction.
5. Click `Gerar assets`.
6. Select one generated asset.
7. Test the three composition options.
8. Reject one asset with a reason and confirm the regeneration instruction is
   prepared.
9. Click `Desfazer rejeicao` and confirm the same asset becomes selectable and
   selected again.
10. Generate another asset if needed.
11. Approve the final visual version.
12. Finalize the package.
13. Download the ZIP and confirm it includes:
    - `final/post-1080x1350.png`;
    - `copy/legenda.txt`;
    - `copy/primeiro-comentario.txt`;
    - `copy/hashtags.txt`;
    - `asset/asset-prompt.txt`;
    - `metadata.json`;
    - `visual-history.json`.
14. Confirm `/approved` shows visual and package status.
15. Download the PNG and confirm it is 1080x1350.

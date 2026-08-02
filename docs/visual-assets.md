# Marco 4.0 Visual Asset Engine

Date: 2026-08-02

## Scope

Marco 4.0 adds a minimal visual asset step after a final post package has been
approved.

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
- 1080x1350 image-led composition with headline, support copy, CTA, and brand;
- PNG download of the selected asset composition.

The model prompt explicitly asks for visual-only output. Text, letters, logos,
captions, watermarks, and UI labels must stay out of the generated image because
the app renders copy and brand elements itself.

The image-led renderer uses its own composition rules. It keeps the generated
asset as the visual subject, places the copy in a single lower text panel, and
keeps brand name, headline, support copy, and CTA inside that same hierarchy.
The renderer should not duplicate the brand name in the footer or leave support
copy and CTA floating over the image.

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

Marco 4.0 extends approved post records in:

```text
socialmediaautomator.approvedPosts.v1
```

New fields:

```ts
generatedAssets: GeneratedVisualAsset[]
selectedVisualAssetId: string | null
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
7. Confirm the main preview changes to the composed image-led post.
8. Download the PNG and confirm it is 1080x1350.

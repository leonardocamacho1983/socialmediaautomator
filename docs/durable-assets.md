# Marco 8 Durable Asset Storage

Date: 2026-08-02

## Scope

Marco 8 adds durable storage for final creative files. It does not add
publishing, Zernio, scheduling, analytics, Reels, or automation.

Included:

- private Supabase Storage bucket `studio-assets`;
- metadata table `public.studio_asset_outputs`;
- internal API route `GET /api/storage/outputs`;
- internal API route `POST /api/storage/outputs`;
- signed download URLs generated server-side;
- final PNG 1080x1350 upload;
- final SVG source upload;
- selected generated asset upload when available;
- approved carousel slide PNG and SVG uploads;
- carousel ZIP upload when the carousel is approved;
- final package ZIP upload;
- visible output list in `/approved/[postId]`;
- aggregated delivery library in `/outputs`;
- approved post snapshots keep lightweight durable-output metadata.

Not included:

- direct browser access to Supabase service keys;
- public buckets;
- user auth or ownership policies;
- deleting remote files from the UI;
- permanent public URLs;
- Zernio publishing.

## Runtime Model

The browser still renders PNG and ZIP files because the current renderer runs in
the client. The browser sends one file at a time to the internal Next.js API.
The API uploads the file to Supabase Storage with the server-only service key and
stores metadata in Postgres.

```text
browser-rendered Blob
  -> /api/storage/outputs
  -> Supabase Storage private bucket
  -> public.studio_asset_outputs metadata
  -> signed URL returned to browser
```

## Environment

Required on the server:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
POSTGRES_URL
```

Fallback names are supported where already used:

```text
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SECRET_KEY
POSTGRES_URL_NON_POOLING
POSTGRES_PRISMA_URL
```

No storage secret is exposed to the browser.

## Database Contract

Migration:

```text
supabase/migrations/20260803005820_create_studio_asset_outputs.sql
```

Bucket:

```text
studio-assets
```

Table:

```text
public.studio_asset_outputs
```

RLS is enabled on the metadata table. `anon` and `authenticated` have no direct
access. `service_role` has explicit access for server-side operations.

Storage remains private. The app returns signed URLs for review/download.

## Manual Validation

1. Open `/approved/[postId]` for a finalized package.
2. Confirm the final package status is `ready`.
3. Click `Salvar no storage`.
4. Confirm progress advances file by file.
5. Confirm the file list appears under `Arquivos duraveis`.
6. Click `Abrir` on the final PNG and confirm the signed URL opens.
7. Reload the page and confirm the file list is loaded again.
8. Open `/projects` and confirm the project shows the `Storage` flag.
9. Open `/outputs` and confirm the saved package appears with PNG/ZIP links.

## Current Limit

Uploads still pass through the Next.js API as base64. This is acceptable for the
current PNG/SVG/ZIP sizes. If generated image files become large, the next step
is signed upload URLs so the browser can upload directly to Storage without
passing the file body through the function.

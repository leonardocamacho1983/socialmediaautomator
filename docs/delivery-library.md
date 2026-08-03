# Marco 9 Delivery Library

Date: 2026-08-03

## Scope

Marco 9 adds a delivery library for final packages saved in durable storage.
It does not add Zernio, scheduling, publishing, analytics, Reels, or
engagement automation.

Included:

- `/outputs` page;
- `GET /api/storage/packages`;
- grouped final-package list by approved post;
- signed links for saved PNG, SVG, ZIP, carousel ZIP and selected asset;
- search by title, brand, copy, file name and hashtag;
- filters for ZIP final, carousel, asset and copy-ready deliveries;
- copy buttons for caption and first comment;
- direct link back to the approved post detail;
- fallback in `/approved/[postId]` to recover persisted posts from the database
  when browser storage is empty.

## Runtime Model

The package files continue to live in the private Supabase Storage bucket
`studio-assets`. The browser never receives a Supabase service key. The API
route reads `public.studio_asset_outputs`, joins the persisted approved-post
snapshot from `public.studio_projects`, signs each file URL server-side and
returns a compact package summary to the UI.

```text
/outputs
  -> /api/storage/packages
  -> public.studio_asset_outputs
  -> public.studio_projects
  -> signed Storage links
```

## Manual Validation

1. Open `/outputs`.
2. Confirm saved packages appear after using `Salvar no storage`.
3. Search by brand, title, caption, hashtag or file name.
4. Filter by `ZIP final`, `Com carrossel`, `Com asset` and `Copy pronta`.
5. Open the PNG and ZIP links.
6. Copy the caption and first comment.
7. Click `Abrir post` and confirm the detail page loads even after refreshing
   the browser.

## Current Limit

The library lists the latest 100 delivery packages based on the latest 1000
stored output files. That is enough for the current internal workflow. If this
becomes a daily production archive, add pagination and explicit package
versions.

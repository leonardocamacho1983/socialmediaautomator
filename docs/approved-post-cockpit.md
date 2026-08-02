# Marco 3.5 Approved Posts Cockpit

Date: 2026-08-02

## Scope

Marco 3.5 makes `/approved` work more like an operational cockpit for the local
post library.

Included:

- route `/approved` remains the central library;
- counters for all, approved, exported, and ready to publish posts;
- clickable status cards that filter the list;
- search across title, brand, caption, first comment, hashtags, concept, and
  internal notes;
- status select filter;
- visible result count;
- clear filters action;
- empty state for filtered searches.

Not included:

- Supabase persistence;
- Zernio;
- scheduling or publishing;
- analytics;
- comment or DM automation;
- generated visual assets;
- carousels.

## Local Storage Contract

The cockpit reads the existing browser-local collection:

```text
socialmediaautomator.approvedPosts.v1
```

No schema migration is required. The cockpit only derives counts and filtered
views from the approved post records already stored locally.

## Validation

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Manual validation:

1. Open `/approved` with multiple approved posts in local storage.
2. Confirm the counters match the visible statuses.
3. Click each status card and confirm the list filters correctly.
4. Search by title, brand, caption, hashtag, and note text.
5. Clear filters and confirm all posts return.
6. Open `Detalhes` from a filtered result.
7. Mark an item ready or export it, return to `/approved`, and confirm counters
   update after the local record changes.

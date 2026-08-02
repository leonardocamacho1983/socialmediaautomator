# Marco 3.3 Approved Posts Library

Date: 2026-08-02

## Scope

Marco 3.3 adds a local destination after a final post package is approved.
This prevents the workflow from ending on the approval screen.

Included:

- route `/approved`;
- local browser library of approved final post packages;
- preview of the selected typographic PNG composition;
- selected caption, first comment, and hashtags;
- cockpit counters for all, approved, exported, and ready to publish posts;
- search by title, brand, caption, comment, hashtags, concept, or notes;
- filter by operational status;
- actions to reopen the package, duplicate it into a new project, export PNG,
  copy caption, copy first comment, copy the full package, and mark the post as
  ready to publish;
- link each approved post to its detail page at `/approved/[postId]`;
- link from the final package approval state to `/approved`;
- link to start a new post after approval.

Not included:

- Supabase persistence;
- Zernio;
- scheduling or publishing;
- analytics;
- comment or DM automation;
- generated visual assets;
- carousels.

## Local Storage Contract

Approved packages are stored under:

```text
socialmediaautomator.approvedPosts.v1
```

Each item stores a complete `CreativeProject` snapshot. This is deliberate for
now: the library must preserve the exact concept, visual piece, caption package,
and approval checklist that existed when the post was approved.

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

1. Open `/create` with a project that has visual piece and caption.
2. Approve the final package.
3. Confirm `Ver posts aprovados` appears.
4. Open `/approved`.
5. Confirm the approved post appears with preview, caption, first comment, and
   hashtags.
6. Confirm the cockpit counters reflect the current statuses.
7. Filter by status and confirm the visible list changes.
8. Search by title, brand, hashtag, or caption text.
9. Clear filters.
10. Open `Detalhes`.
11. Mark the post as ready.
12. Reopen the post and confirm the final package is restored in `/create`.
13. Duplicate the post and confirm it starts a new editable project without
   carrying the previous final approval.

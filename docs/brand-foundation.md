# Marco 1 Brand Foundation

Date: 2026-07-31

## Scope

Marco 1 adds a single brand profile screen at `/brand`.

Included:

- business and product description;
- value proposition;
- audience;
- tone of voice;
- preferred and forbidden words;
- core colors;
- heading and body font names;
- logo upload for local preview;
- visual references;
- good and bad examples;
- structured preview for `brandProfile`, `writingProfile`, and `visualProfile`.

Not included:

- Supabase persistence;
- server-side uploads;
- AI generation;
- Recraft or image generation;
- Zernio;
- publishing;
- analytics;
- engagement automation;
- multiple users or multiple brands.

## Persistence

The profile is stored in browser `localStorage` under:

```text
socialmediaautomator.brandProfile.v1
```

This is intentional for Marco 1. The goal is to validate the brand contract
before adding database schema and storage.

## Contract

The canonical TypeScript contract lives in:

```text
lib/brand/profile.ts
```

Future milestones should consume the structured profiles instead of reading raw
form fields directly.

## Validation

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

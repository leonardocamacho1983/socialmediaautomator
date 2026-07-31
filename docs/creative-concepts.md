# Marco 2 Creative Concept Generator

Date: 2026-07-31

## Scope

Marco 2 adds a creative concept generator at `/create`.

Included:

- reads the single brand profile stored by Marco 1;
- accepts a post briefing;
- calls the Vercel AI Gateway through the AI SDK;
- generates exactly three structured creative concepts;
- shows each concept with hook, central idea, narrative structure, visual
  direction, copy direction, fit rationale, and risk notes;
- lets the user choose one concept;
- persists the latest generated project and selected concept in browser
  `localStorage`.

Not included:

- final copy;
- rendered assets;
- Recraft or image generation;
- Supabase persistence;
- Zernio;
- scheduling or publishing;
- analytics;
- engagement automation;
- multiple brands or users.

## AI Gateway

The API route is:

```text
POST /api/concepts
```

It uses the AI SDK with structured output:

```text
generateText + Output.object
```

Default model:

```text
anthropic/claude-sonnet-5
```

Override with:

```text
CREATIVE_CONCEPT_MODEL=
```

Authentication is handled by either:

```text
AI_GATEWAY_API_KEY
```

or the Vercel runtime authentication path in deployment. A Shared Environment
Variable can exist at account level without appearing as a project-level
environment variable; the definitive validation is a successful
`POST /api/concepts` call.

## Local Persistence

The latest project is stored at:

```text
socialmediaautomator.creativeProject.v1
```

This is intentional. Database persistence starts only after the creative
concept contract proves useful.

## Validation

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

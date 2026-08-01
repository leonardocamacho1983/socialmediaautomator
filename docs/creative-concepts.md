# Marco 2 Creative Concept Generator

Date: 2026-07-31

## Scope

Marco 2 adds a creative concept generator at `/create`.

Included:

- reads the single brand profile stored by Marco 1;
- accepts a post briefing;
- calls the Vercel AI Gateway through the AI SDK;
- strips embedded brand assets such as `logoDataUrl` before generation;
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

It uses the AI SDK through the Vercel AI Gateway and parses model JSON locally:

```text
generateText -> JSON extraction -> Zod validation
```

Default model:

```text
openai/gpt-5.4-mini
```

Fallback model:

```text
anthropic/claude-haiku-4.5
```

Override with `CREATIVE_CONCEPT_MODEL=` and
`CREATIVE_CONCEPT_FALLBACK_MODEL=`.

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

Brand images may remain in the browser profile for later visual production, but
Marco 2 sends only text-safe brand context to the concept generator. The model
receives whether a logo exists and its file name, not the embedded image data.

## Validation

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

# Social Media Automator

Clean reset baseline for the Social Media Automator project.

This repository currently contains:

- a fresh Next.js App Router app;
- TypeScript and ESLint configuration;
- a minimal home page;
- a minimal health check at `/api/health`;
- reset documentation in `docs/reset.md`;
- Marco 1 Brand Foundation at `/brand`;
- Marco 2 Creative Concept Generator at `/create`.
- Marco 3 Typographic Post Workshop inside `/create`.
- Marco 3.1 Caption Workshop inside `/create`.
- Marco 3.2 Final Post Package inside `/create`.
- Marco 3.3 Approved Posts Library at `/approved`.
- Marco 3.4 Approved Post Detail at `/approved/[postId]`.
- Marco 3.5 Approved Posts Cockpit filters inside `/approved`.

The app still does not generate image assets, carousels, automations,
analytics, or publications.

## Local

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

# Marco 7 Persistence

Date: 2026-08-02

## Scope

Marco 7 adds the first durable project library without changing the creative
generation flow.

Included:

- route `/projects`;
- API routes `GET /api/projects`, `POST /api/projects`,
  `GET /api/projects/[projectId]`, and `DELETE /api/projects/[projectId]`;
- server-side Postgres persistence through `POSTGRES_URL`;
- Supabase REST fallback through `SUPABASE_URL` and a server-only service key;
- idempotent creation of `public.studio_projects` when the app has permission;
- Supabase migration for the same table;
- browser localStorage kept as cache and fallback;
- synchronization of the current `/create` project;
- synchronization of approved posts from `/approved` and `/approved/[postId]`;
- button to migrate existing local browser projects into the database;
- reopen persisted creative projects in `/create`;
- reopen persisted approved posts in `/approved/[postId]`.

Not included:

- Supabase Auth;
- multiple users;
- row ownership;
- storage bucket for image binaries;
- Zernio;
- publishing;
- scheduling;
- analytics;
- comment or DM automation.

## Environment

The server-side repository first tries the direct Postgres connection:

```text
POSTGRES_URL
POSTGRES_URL_NON_POOLING
POSTGRES_PRISMA_URL
```

If those variables are not available, it falls back to the Supabase REST API
when these server-side variables are present:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

`NEXT_PUBLIC_SUPABASE_URL` can be used as a URL fallback, and
`SUPABASE_SECRET_KEY` can be used as a service-key fallback.

No database secret is exposed to the browser. Client components only call the
internal Next.js API routes.

## Database Contract

Migration:

```text
supabase/migrations/20260803001027_create_studio_projects.sql
```

Table:

```text
public.studio_projects
```

Important columns:

- `id`;
- `title`;
- `brand_name`;
- `source`;
- `status`;
- `visual_status`;
- `final_package_status`;
- `carousel_status`;
- `project_data`;
- `approved_post_data`;
- `summary`;
- `created_at`;
- `updated_at`;
- `deleted_at`.

The table stores complete JSONB snapshots because the studio still changes
quickly. Later milestones can split assets, versions, campaigns, and posts into
more normalized tables.

RLS is enabled. `anon` and `authenticated` have no direct table grants. The
`service_role` role has explicit table grants so the server-side REST fallback
can reach the table in newer Supabase projects. The app uses server-side
database access only.

## Runtime Behavior

The app still writes localStorage first for continuity:

```text
socialmediaautomator.brandProfile.v1
socialmediaautomator.creativeProject.v1
socialmediaautomator.approvedPosts.v1
```

Then it syncs the project snapshot to the database in the background. If the
database is unavailable, the UI keeps working and shows a persistence warning.

The `/projects` page can also sync all current browser-local items manually.

## Validation

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Manual validation:

1. Open `/projects`.
2. Confirm the page either loads persisted projects or clearly reports that
   persistence is not configured.
3. Create or edit a project in `/create`.
4. Return to `/projects` and click `Atualizar`.
5. Confirm the project appears.
6. Approve a final package.
7. Confirm the approved post appears in `/projects`.
8. Click `Abrir` on a draft project and confirm it opens in `/create`.
9. Click `Abrir` on an approved post and confirm it opens in
   `/approved/[postId]`.
10. Click `Sincronizar navegador` and confirm local projects are saved to the
    database.
11. Remove a project from the database and confirm it disappears from
    `/projects`.

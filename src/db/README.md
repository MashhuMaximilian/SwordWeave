# Database Layer

Drizzle schema files, migrations, and database-facing handlers live here.

The current schema is provider-agnostic PostgreSQL. For Vercel deployment, use a Vercel Marketplace Postgres provider such as Neon, then expose the generated `DATABASE_URL` to this app.

## Local Workflow

After creating the Neon database in Vercel:

```bash
vercel env pull .env.local
npm run db:generate
npm run db:migrate
```

Use `npm run db:push` only for early prototype syncs when you intentionally want Drizzle to push schema changes directly without a migration review.

# Database Layer

Drizzle schema files, migrations, and database-facing handlers live here.

The current schema is provider-agnostic PostgreSQL. For Vercel deployment, prefer a Vercel Marketplace Postgres provider such as Neon, then wire the generated `DATABASE_URL` into the Drizzle client and migration config in a later step.

No database connection is initialized yet. The schema layer is complete enough for migration generation once the runtime database target is chosen.

## CRM-dev

This folder is a **developer export pack** of the CRM’s Supabase artefacts, organised so you can run things locally or against a dev Supabase project.

### What’s included

- **Database SQL (individual files)**: `db/sql/`
- **Migrations folder (currently empty in this repo)**: `db/migrations/`
- **Edge functions (source)**: `edge-functions/supabase-functions/`

### Database: running the SQL

All SQL scripts are kept as individual files under `db/sql/`.

Suggested execution order (as a starting point):

1. Files that define core structure first (often named like `*_module.sql`, `*_schema.sql`, `*_management.sql`, `daily_deal_flow.sql`)
2. Then permissions / RLS / grants (often `permissions_*`, `*_rls_*`, `grant_*`, `policies_*`)
3. Then seeds / backfills / fixes (often `*_seed.sql`, `backfill_*`, `cleanup_*`, `fix_*`)

If a script fails due to a missing dependency, run the dependency script first and re-run.

### Edge functions

Edge functions are copied from `supabase/functions/` into:

- `edge-functions/supabase-functions/`

Deploy/run them using the Supabase CLI in whatever way you normally do for your dev project.


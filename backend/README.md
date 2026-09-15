# Backend Service — HR Onboarding Platform

## Manual Setup Step: pgvector Extension

This project connects directly to an already-installed local PostgreSQL instance (no Docker containers are used).

Before running any Prisma migrations on a target database, you **must manually enable the `pgvector` extension** on that database.

> [!IMPORTANT]
> **One-Time Manual Step:** This step must be performed by hand once per machine / database instance, since there is no Docker container or entrypoint script to pre-bake it into.

### Instructions:

1. Connect to your PostgreSQL instance using `psql` or your preferred SQL client (e.g. pgAdmin, DBeaver):
   ```bash
   psql -U postgres -d <your_database_name>
   ```

2. Run the following SQL command:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. Ensure your `backend/.env` has the correct `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DBNAME"
   ```

4. Now you can run migrations:
   ```bash
   npx prisma migrate dev --name init
   ```

## Development

Start the development server:
```bash
npm run dev
```

The server exposes a health-check endpoint at `GET /health` returning `{"status": "ok"}`.

### Rate Limiting & Local Testing

During manual multi-role testing (switching rapidly between HR Admin, Manager, and Employee roles), the login rate limiter (5 attempts / 15m) and general rate limiter (100 reqs / 15m) can be temporarily disabled:

In `backend/.env`:
```env
DISABLE_RATE_LIMITING="true"
```

> [!WARNING]
> `DISABLE_RATE_LIMITING` is strictly an opt-in escape hatch for **local development and testing only**. It must **NEVER** be set to `true` in any staging, production, or deployed environment per `security.md` Section 1 and Section 7. When active, a prominent warning banner is logged at server startup.


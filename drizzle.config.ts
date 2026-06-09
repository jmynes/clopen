import { defineConfig } from 'drizzle-kit';

// Local-only personal tool: default to a SQLite file in the project root.
const url = process.env.DATABASE_URL ?? 'file:./local.db';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  },
});

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sportz';

if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL is not defined in environment variables');
} else if (!process.env.DATABASE_URL) {
  console.warn('⚠️ [Database] DATABASE_URL not set in .env. Using fallback localhost connection string.');
}

export const pool = new Pool({
  connectionString,
});

import * as schema from './schema.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

export const db = drizzle(pool, { schema });

export const runMigrations = async () => {
  try {
    console.log('[Database] Checking and applying database migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('[Database] Migrations applied successfully.');
  } catch (err) {
    console.warn(`[Database] Auto-migration skipped or failed (${err.message}). Resilient dual-mode active.`);
  }
};

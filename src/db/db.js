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

export const db = drizzle(pool, { schema });

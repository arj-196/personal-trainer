import { Pool } from 'pg';

import { logger } from './logger';

let pool: Pool | null = null;

export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error('DATABASE_URL is required.');
  }
  return value;
}

export function getPool(): Pool {
  if (!pool) {
    logger.info('Creating PostgreSQL pool');
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: process.env.POSTGRES_SSL === 'disable' ? false : undefined,
    });
  }
  return pool;
}

export async function query<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(text, values);
  return result.rows;
}

export async function queryOne<T extends Record<string, unknown>>(
  text: string,
  values: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, values);
  return rows[0] ?? null;
}

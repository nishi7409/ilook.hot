import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://ilook:ilook_secret@localhost:5433/ilook';

const client = postgres(connectionString, { max: 10 });
export const db = drizzle(client, { schema });
export type DB = typeof db;

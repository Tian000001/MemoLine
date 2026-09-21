import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Module } from '@nestjs/common';
import { createClient } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

export const DRIZZLE_DATABASE = 'DRIZZLE_DATABASE';
export type DbType = LibSQLDatabase<typeof schema>;

const databaseUrl = process.env.DATABASE_URL || 'file:./data/app.db';
const dbDir = databaseUrl.startsWith('file:')
  ? dirname(databaseUrl.slice('file:'.length))
  : null;

if (dbDir) {
  mkdirSync(dbDir, { recursive: true });
}

const client = createClient({ url: databaseUrl });
export const db: DbType = drizzle(client, { schema });

@Module({
  providers: [{ provide: DRIZZLE_DATABASE, useValue: db }],
  exports: [DRIZZLE_DATABASE],
})
export class DatabaseModule {}

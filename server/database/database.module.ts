import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Injectable, Module, OnModuleInit } from '@nestjs/common';
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

/**
 * Idempotent schema bootstrap. The original Feishu apaas template relied on a
 * managed database, so we create the local SQLite tables ourselves on startup.
 * Runs during Nest's onModuleInit (before the HTTP server starts accepting
 * requests), so every table exists by the time any query runs.
 */
const SCHEMA_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS "events" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "event_time" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_events_event_time" ON "events" ("event_time")`,

  `CREATE TABLE IF NOT EXISTS "event_chat_records" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "event_id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "send_time" TEXT,
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_chat_records_event_id" ON "event_chat_records" ("event_id")`,

  `CREATE TABLE IF NOT EXISTS "event_media" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "event_id" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_url" TEXT,
    "file_name" TEXT,
    "file_size" INTEGER,
    "created_at" TEXT NOT NULL,
    FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_event_media_event_id" ON "event_media" ("event_id")`,

  `CREATE TABLE IF NOT EXISTS "analysis_reports" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "title" TEXT NOT NULL,
    "time_range_start" TEXT,
    "time_range_end" TEXT,
    "summary" TEXT,
    "key_persons" TEXT NOT NULL DEFAULT '[]',
    "key_timelines" TEXT NOT NULL DEFAULT '[]',
    "doubts" TEXT NOT NULL DEFAULT '[]',
    "evidence_categories" TEXT NOT NULL DEFAULT '[]',
    "full_report" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
  )`,
];

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    // Enable foreign-key cascade deletes for this connection.
    await client.execute(`PRAGMA foreign_keys = ON`);
    for (const sql of SCHEMA_SQL) {
      await client.execute(sql);
    }
  }
}

@Module({
  providers: [
    { provide: DRIZZLE_DATABASE, useValue: db },
    DatabaseInitService,
  ],
  exports: [DRIZZLE_DATABASE],
})
export class DatabaseModule {}

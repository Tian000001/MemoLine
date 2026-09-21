import { blob, index, integer, sqliteTable, text, foreignKey } from 'drizzle-orm/sqlite-core';
import type {
  KeyPerson,
  KeyTimeline,
  Doubt,
  EvidenceCategory,
} from '../modules/analysis/ai-report-parser';

export const analysisReports = sqliteTable('analysis_reports', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  timeRangeStart: text('time_range_start'),
  timeRangeEnd: text('time_range_end'),
  summary: text('summary'),
  keyPersons: blob('key_persons', { mode: 'json' })
    .$type<KeyPerson[]>()
    .notNull()
    .default([]),
  keyTimelines: blob('key_timelines', { mode: 'json' })
    .$type<KeyTimeline[]>()
    .notNull()
    .default([]),
  doubts: blob('doubts', { mode: 'json' })
    .$type<Doubt[]>()
    .notNull()
    .default([]),
  evidenceCategories: blob('evidence_categories', { mode: 'json' })
    .$type<EvidenceCategory[]>()
    .notNull()
    .default([]),
  fullReport: text('full_report'),
  status: text('status', { length: 20 }).notNull().default('pending'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const eventChatRecords = sqliteTable(
  'event_chat_records',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id').notNull(),
    sender: text('sender').notNull(),
    content: text('content').notNull(),
    sendTime: text('send_time'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_chat_records_event_id').on(table.eventId),
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [events.id],
      name: 'event_chat_records_event_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const eventMedia = sqliteTable(
  'event_media',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id').notNull(),
    mediaType: text('media_type', { length: 20 }).notNull(),
    filePath: text('file_path').notNull(),
    fileUrl: text('file_url'),
    fileName: text('file_name'),
    fileSize: integer('file_size'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_event_media_event_id').on(table.eventId),
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [events.id],
      name: 'event_media_event_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    eventTime: text('event_time').notNull(),
    location: text('location'),
    description: text('description').notNull(),
    tags: blob('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_events_event_time').on(table.eventTime)],
);

// table aliases
export const analysisReportsTable = analysisReports;
export const eventChatRecordsTable = eventChatRecords;
export const eventMediaTable = eventMedia;
export const eventsTable = events;

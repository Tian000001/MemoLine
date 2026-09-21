import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, like, gte, lte, sql } from 'drizzle-orm';
import { events, eventMedia, eventChatRecords } from '@server/database/schema';
import { DRIZZLE_DATABASE, type DbType } from '@server/database/database.module';
import { parseChatText } from './utils/chat-parser';
import type { CreateEventDto } from './dto/create-event.dto';
import type { UpdateEventDto } from './dto/update-event.dto';
import type { ListEventsDto } from './dto/list-events.dto';
import type {
  EventDetail,
  EventItem,
  EventListResponse,
  EventMedia,
  ChatRecord,
  ParseChatRecordResponse,
} from '@shared/api.interface';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: DbType) {}

  async list(query: ListEventsDto): Promise<EventListResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const where = this.buildWhere(query);
    const whereExpr = where.length > 0 ? and(...where) : undefined;

    const [rows, totalResult] = await Promise.all([
      this.db
        .select({
          id: events.id,
          eventTime: events.eventTime,
          location: events.location,
          description: events.description,
          tags: events.tags,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt,
          mediaCount: this.db.$count(
            eventMedia,
            eq(eventMedia.eventId, events.id),
          ),
          chatRecordCount: this.db.$count(
            eventChatRecords,
            eq(eventChatRecords.eventId, events.id),
          ),
        })
        .from(events)
        .where(whereExpr)
        .orderBy(desc(events.eventTime))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(events)
        .where(whereExpr),
    ]);

    const items: EventItem[] = rows.map((row) => ({
      id: row.id,
      eventTime: row.eventTime,
      location: row.location,
      description: row.description,
      tags: row.tags ?? [],
      mediaCount: row.mediaCount,
      chatRecordCount: row.chatRecordCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return {
      items,
      total: totalResult[0]?.count ?? 0,
      page,
      pageSize,
    };
  }

  async getById(id: string): Promise<EventDetail> {
    const [eventRows, mediaRows, chatRows] = await Promise.all([
      this.db.select().from(events).where(eq(events.id, id)).limit(1),
      this.db
        .select()
        .from(eventMedia)
        .where(eq(eventMedia.eventId, id))
        .orderBy(asc(eventMedia.createdAt)),
      this.db
        .select()
        .from(eventChatRecords)
        .where(eq(eventChatRecords.eventId, id))
        .orderBy(asc(eventChatRecords.sendTime), asc(eventChatRecords.createdAt)),
    ]);

    const event = eventRows[0];
    if (!event) {
      throw new NotFoundException('事件不存在');
    }

    const media: EventMedia[] = mediaRows.map((m) => ({
      id: m.id,
      eventId: m.eventId,
      mediaType: m.mediaType as 'image' | 'video',
      filePath: m.filePath,
      fileUrl: m.fileUrl ?? '',
      fileName: m.fileName,
      fileSize: m.fileSize,
    }));

    const chatRecords: ChatRecord[] = chatRows.map((c) => ({
      id: c.id,
      eventId: c.eventId,
      sender: c.sender,
      content: c.content,
      sendTime: c.sendTime ?? null,
    }));

    return {
      id: event.id,
      eventTime: event.eventTime,
      location: event.location,
      description: event.description,
      tags: event.tags ?? [],
      mediaCount: media.length,
      chatRecordCount: chatRecords.length,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      media,
      chatRecords,
    };
  }

  async create(dto: CreateEventDto): Promise<EventDetail> {
    const now = new Date().toISOString();
    const chatFromText = dto.chatRecordText
      ? parseChatText(dto.chatRecordText).records
      : [];

    const allChatRecords = [
      ...(dto.chatRecords ?? []).map((r) => ({
        sender: r.sender,
        content: r.content,
        sendTime: r.sendTime ?? null,
      })),
      ...chatFromText,
    ];

    const result = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(events)
        .values({
          id: randomUUID(),
          eventTime: dto.eventTime,
          location: dto.location ?? null,
          description: dto.description,
          tags: dto.tags ?? [],
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (dto.media && dto.media.length > 0) {
        await tx.insert(eventMedia).values(
          dto.media.map((m) => ({
            id: randomUUID(),
            eventId: created.id,
            mediaType: m.mediaType,
            filePath: m.filePath,
            fileUrl: m.fileUrl ?? null,
            fileName: m.fileName ?? null,
            fileSize: m.fileSize ?? null,
            createdAt: now,
          })),
        );
      }

      if (allChatRecords.length > 0) {
        await tx.insert(eventChatRecords).values(
          allChatRecords.map((r) => ({
            id: randomUUID(),
            eventId: created.id,
            sender: r.sender,
            content: r.content,
            sendTime: r.sendTime ? r.sendTime : null,
            createdAt: now,
          })),
        );
      }

      return created;
    });

    this.logger.log(`创建事件成功: ${result.id}`);
    return this.getById(result.id);
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventDetail> {
    const patch: Partial<typeof events.$inferInsert> = {};
    if (dto.eventTime !== undefined) patch.eventTime = dto.eventTime;
    if (dto.location !== undefined) patch.location = dto.location;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.tags !== undefined) patch.tags = dto.tags;

    if (Object.keys(patch).length === 0) {
      return this.getById(id);
    }

    patch.updatedAt = new Date().toISOString();

    const updated = await this.db
      .update(events)
      .set(patch)
      .where(eq(events.id, id))
      .returning({ id: events.id });

    if (updated.length === 0) {
      throw new NotFoundException('事件不存在');
    }

    this.logger.log(`更新事件成功: ${id}`);
    return this.getById(id);
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.db
      .delete(events)
      .where(eq(events.id, id))
      .returning({ id: events.id });

    if (deleted.length === 0) {
      throw new NotFoundException('事件不存在');
    }

    this.logger.log(`删除事件成功: ${id}`);
  }

  parseChat(text: string): ParseChatRecordResponse {
    return parseChatText(text);
  }

  private buildWhere(query: ListEventsDto) {
    const conditions = [];

    if (query.keyword) {
      const kw = `%${query.keyword}%`;
      conditions.push(
        sql`(${like(events.description, kw)} OR ${like(events.location, kw)})`,
      );
    }

    if (query.location) {
      conditions.push(like(events.location, `%${query.location}%`));
    }

    if (query.tag) {
      conditions.push(
        sql`exists (select 1 from json_each(${events.tags}) where json_each.value = ${query.tag})`,
      );
    }

    if (query.startTime) {
      conditions.push(gte(events.eventTime, query.startTime));
    }

    if (query.endTime) {
      conditions.push(lte(events.eventTime, query.endTime));
    }

    return conditions;
  }
}

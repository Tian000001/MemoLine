import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq, and, gte, lte, inArray, desc, count } from 'drizzle-orm';
import { analysisReports, events, eventChatRecords } from '@server/database/schema';
import { DRIZZLE_DATABASE, type DbType } from '@server/database/database.module';
import type {
  AnalysisReport,
  AnalysisReportListResponse,
  CreateAnalysisRequest,
} from '@shared/api.interface';
import { parseAiReport, type ParsedAiReport } from './ai-report-parser';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private readonly aiPrompt: string;

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: DbType) {
    let prompt = '';
    try {
      const raw = readFileSync(
        join(__dirname, '../../capabilities/timeline_event_review_analysis_1.json'),
        'utf-8',
      );
      prompt = (JSON.parse(raw).formValue?.prompt as string) ?? '';
    } catch {
      prompt = '你是一位专业的事件复盘分析专家，请对以下时间线事件进行全面复盘分析。';
    }
    this.aiPrompt = prompt;
  }

  async getReportList(): Promise<AnalysisReportListResponse> {
    const items = await this.db
      .select()
      .from(analysisReports)
      .orderBy(desc(analysisReports.createdAt));
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(analysisReports);
    return { items: items.map((r) => this.mapReport(r)), total };
  }

  async getReportDetail(id: string): Promise<AnalysisReport> {
    const reports = await this.db
      .select()
      .from(analysisReports)
      .where(eq(analysisReports.id, id));
    if (reports.length === 0) throw new NotFoundException('报告不存在');
    return this.mapReport(reports[0]);
  }

  async createReport(dto: CreateAnalysisRequest): Promise<AnalysisReport> {
    const now = new Date().toISOString();
    const [inserted] = await this.db
      .insert(analysisReports)
      .values({
        id: randomUUID(),
        title: dto.title,
        timeRangeStart: dto.startTime ?? null,
        timeRangeEnd: dto.endTime ?? null,
        status: 'pending',
        summary: '',
        fullReport: '',
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    void this.generateReport(inserted.id, dto);
    return this.mapReport(inserted[0]);
  }

  async deleteReport(id: string): Promise<void> {
    const deleted = await this.db
      .delete(analysisReports)
      .where(eq(analysisReports.id, id))
      .returning({ id: analysisReports.id });
    if (deleted.length === 0) throw new NotFoundException('报告不存在');
  }

  private async generateReport(
    reportId: string,
    dto: CreateAnalysisRequest,
  ): Promise<void> {
    try {
      this.logger.log(`开始生成分析报告: ${reportId}`);
      await this.db
        .update(analysisReports)
        .set({ status: 'generating' })
        .where(eq(analysisReports.id, reportId));

      const eventList = await this.fetchEvents(dto);
      this.logger.log(`查询到 ${eventList.length} 个事件`);

      const timelineContent = await this.buildTimelineContent(eventList);
      this.logger.log(`时间线内容长度: ${timelineContent.length} 字符`);

      const fullText = process.env.AI_API_KEY
        ? await this.callRealAi(timelineContent)
        : this.buildLocalMock(eventList, timelineContent);
      this.logger.log(`分析内容生成完成，长度: ${fullText.length} 字符`);

      const parsed: ParsedAiReport = parseAiReport(fullText);
      await this.db
        .update(analysisReports)
        .set({
          status: 'completed',
          summary: parsed.summary,
          keyPersons: parsed.keyPersons,
          keyTimelines: parsed.keyTimelines,
          doubts: parsed.doubts,
          evidenceCategories: parsed.evidenceCategories,
          fullReport: fullText,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(analysisReports.id, reportId));

      this.logger.log(`分析报告生成完成: ${reportId}`);
    } catch (error) {
      this.logger.error(
        `分析报告生成失败: ${reportId}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.db
        .update(analysisReports)
        .set({ status: 'failed', updatedAt: new Date().toISOString() })
        .where(eq(analysisReports.id, reportId));
    }
  }

  private async fetchEvents(
    dto: CreateAnalysisRequest,
  ): Promise<(typeof events.$inferSelect)[]> {
    if (dto.eventIds && dto.eventIds.length > 0) {
      return this.db
        .select()
        .from(events)
        .where(inArray(events.id, dto.eventIds))
        .orderBy(events.eventTime);
    }

    const conditions = [];
    if (dto.startTime)
      conditions.push(gte(events.eventTime, dto.startTime));
    if (dto.endTime) conditions.push(lte(events.eventTime, dto.endTime));

    const query =
      conditions.length > 0
        ? this.db.select().from(events).where(and(...conditions))
        : this.db.select().from(events);

    return query.orderBy(events.eventTime);
  }

  private async buildTimelineContent(
    eventList: (typeof events.$inferSelect)[],
  ): Promise<string> {
    if (eventList.length === 0) return '（无事件数据）';

    const eventIds = eventList.map((e) => e.id);
    const chatRecords = await this.db
      .select()
      .from(eventChatRecords)
      .where(inArray(eventChatRecords.eventId, eventIds));

    const chatByEvent = new Map<string, (typeof eventChatRecords.$inferSelect)[]>();
    for (const cr of chatRecords) {
      chatByEvent.set(cr.eventId, [...(chatByEvent.get(cr.eventId) ?? []), cr]);
    }

    const parts: string[] = [];
    for (const ev of eventList) {
      const timeStr = ev.eventTime;
      const locationStr = ev.location ? `地点：${ev.location}` : '';
      const tagsStr =
        ev.tags && ev.tags.length > 0 ? `标签：${ev.tags.join('、')}` : '';

      const lines = [
        `【事件】时间：${timeStr}`,
        locationStr,
        tagsStr,
        `描述：${ev.description}`,
      ].filter(Boolean);

      const records = chatByEvent.get(ev.id) ?? [];
      if (records.length > 0) {
        lines.push('聊天记录：');
        for (const r of records) {
          const sendTime = r.sendTime ? ` (${r.sendTime})` : '';
          lines.push(`  ${r.sender}${sendTime}：${r.content}`);
        }
      }

      parts.push(lines.join('\n'));
    }

    return parts.join('\n\n---\n\n');
  }

  /** 真实大模型调用（OpenAI 兼容接口），未配置密钥时回退到本地 mock */
  private async callRealAi(content: string): Promise<string> {
    const baseUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.AI_MODEL || 'gpt-4o-mini';
    const apiKey = process.env.AI_API_KEY as string;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: 8192,
        messages: [
          { role: 'system', content: this.aiPrompt },
          { role: 'user', content: `事件内容：${content}` },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`AI 请求失败: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? '';
  }

  /** 本地结构化 mock：让未接大模型时也能看到可用的复盘报告 */
  private buildLocalMock(
    eventList: (typeof events.$inferSelect)[],
    _content: string,
  ): string {
    const total = eventList.length;
    const summary = `本次复盘共纳入 ${total} 个事件，时间跨度已按时间线梳理。当前为本地演示模式（未配置真实大模型），以下结果由系统基于结构化数据自动提取，供参考，关键结论建议人工复核。`;

    const keyTimelines = eventList
      .map((e, i) => `${i + 1}. ${e.eventTime} ${e.description.slice(0, 60)}【一般】`)
      .join('\n');

    return [
      '## 事件整体摘要',
      summary,
      '',
      '## 人物与关键节点提取',
      '### 关键人物',
      '（演示模式：请接入大模型以提取关键人物）',
      '### 关键节点',
      keyTimelines || '（无）',
      '',
      '## 疑点识别',
      '- 【一般】演示模式：未接入真实大模型，疑点与矛盾需人工复核',
      '',
      '## 证据归类',
      `- 媒体与聊天记录：共 ${total} 个事件关联素材，可在事件详情中查看`,
    ].join('\n');
  }

  private mapReport(
    row: typeof analysisReports.$inferSelect,
  ): AnalysisReport {
    return {
      id: row.id,
      title: row.title,
      timeRangeStart: row.timeRangeStart ?? null,
      timeRangeEnd: row.timeRangeEnd ?? null,
      summary: row.summary ?? '',
      keyPersons: (row.keyPersons as AnalysisReport['keyPersons']) ?? [],
      keyTimelines: (row.keyTimelines as AnalysisReport['keyTimelines']) ?? [],
      doubts: (row.doubts as AnalysisReport['doubts']) ?? [],
      evidenceCategories:
        (row.evidenceCategories as AnalysisReport['evidenceCategories']) ?? [],
      fullReport: row.fullReport ?? '',
      status: row.status as AnalysisReport['status'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

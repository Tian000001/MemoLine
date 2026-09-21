export type KeyPerson = { name: string; role: string; mentions: number };
export type KeyTimeline = { time: string; event: string; importance: string };
export type Doubt = { point: string; description: string; severity: string };
export type EvidenceCategory = { category: string; items: string[] };

export interface ParsedAiReport {
  summary: string;
  keyPersons: KeyPerson[];
  keyTimelines: KeyTimeline[];
  doubts: Doubt[];
  evidenceCategories: EvidenceCategory[];
}

function extractSection(text: string, headings: string[]): string {
  for (const heading of headings) {
    const patterns = [
      new RegExp(`##\\s*${heading}[\\s\\S]*?\\n(?=##\\s|$)`, 'i'),
      new RegExp(`###\\s*${heading}[\\s\\S]*?\\n(?=###?\\s|$)`, 'i'),
      new RegExp(`${heading}[:：][\\s\\S]*?(?=\\n[^\\s-*].*[:：]|$)`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].replace(/^#+\s*[^:\n]*[:：]?\s*\n?/, '').trim();
      }
    }
  }
  return '';
}

function parseKeyPersons(text: string): KeyPerson[] {
  if (!text) return [];
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const result: KeyPerson[] = [];

  for (const line of lines) {
    const cleanLine = line.replace(/^[-*•\d.)]+\s*/, '').trim();
    if (!cleanLine) continue;

    const match = cleanLine.match(/^([^，。：:（(]+)[，。：:（(]([^）)\n]+)?[）)]?/);
    if (match) {
      const name = match[1].trim();
      const role = match[2]?.trim() || '';
      const mentionsMatch = cleanLine.match(/(\d+)\s*次/);
      result.push({
        name,
        role,
        mentions: mentionsMatch ? Number(mentionsMatch[1]) : 0,
      });
    } else if (cleanLine.length < 20) {
      result.push({ name: cleanLine, role: '', mentions: 0 });
    }
  }

  return result.slice(0, 20);
}

function parseKeyTimelines(text: string): KeyTimeline[] {
  if (!text) return [];
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const result: KeyTimeline[] = [];

  for (const line of lines) {
    const cleanLine = line.replace(/^[-*•\d.)]+\s*/, '').trim();
    if (!cleanLine) continue;

    const timeMatch = cleanLine.match(
      /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?(?:\s*\d{1,2}[:：]\d{2})?)|(\d{1,2}[:：]\d{2})/,
    );
    if (timeMatch) {
      const time = timeMatch[0];
      const rest = cleanLine.replace(time, '').replace(/^[-—:：\s]+/, '').trim();
      const importanceMatch = rest.match(/[【\[](重要|一般|次要|高|中|低)[】\]]/);
      const importance = importanceMatch ? importanceMatch[1] : '一般';
      const event = rest.replace(/[【\[](重要|一般|次要|高|中|低)[】\]]/, '').trim();
      result.push({ time, event: event || rest, importance });
    }
  }

  return result.slice(0, 30);
}

function parseDoubts(text: string): Doubt[] {
  if (!text) return [];
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const result: Doubt[] = [];

  for (const line of lines) {
    const cleanLine = line.replace(/^[-*•\d.)]+\s*/, '').trim();
    if (!cleanLine) continue;

    const severityMatch = cleanLine.match(/[【\[](高|中|低|严重|一般|轻微)[】\]]/);
    const severity = severityMatch ? severityMatch[1] : '一般';
    const rest = cleanLine.replace(/[【\[](高|中|低|严重|一般|轻微)[】\]]/, '').trim();

    const colonMatch = rest.match(/^([^：:]{1,30})[：:](.*)/);
    if (colonMatch) {
      result.push({
        point: colonMatch[1].trim(),
        description: colonMatch[2].trim(),
        severity,
      });
    } else if (rest.length < 50) {
      result.push({ point: rest, description: rest, severity });
    }
  }

  return result.slice(0, 20);
}

function parseEvidenceCategories(text: string): EvidenceCategory[] {
  if (!text) return [];
  const result: EvidenceCategory[] = [];

  const categoryBlocks = text.split(/\n(?=[^-*\s])/).filter((b) => b.trim().length > 0);

  for (const block of categoryBlocks) {
    const lines = block.split('\n');
    const firstLine = lines[0].replace(/^[-*•\d.)]+\s*/, '').trim();
    if (!firstLine) continue;

    const categoryName = firstLine.replace(/[:：]\s*$/, '').trim();
    const items: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const item = lines[i].replace(/^[-*•\d.)]+\s*/, '').trim();
      if (item) items.push(item);
    }

    if (items.length > 0 || categoryName) {
      result.push({
        category: categoryName || '未分类',
        items: items.slice(0, 50),
      });
    }
  }

  return result.slice(0, 20);
}

export function parseAiReport(text: string): ParsedAiReport {
  const summary = extractSection(text, ['事件整体摘要', '整体摘要', '摘要']);
  const keyPersonsText = extractSection(text, ['人物与关键节点', '关键人物', '人物分析']);
  const keyTimelinesText = extractSection(text, ['关键节点', '时间节点', '关键时间线']);
  const doubtsText = extractSection(text, ['疑点识别', '疑点分析', '疑点']);
  const evidenceText = extractSection(text, ['证据归类', '证据分类', '证据整理']);

  return {
    summary: summary || text.slice(0, 500),
    keyPersons: parseKeyPersons(keyPersonsText),
    keyTimelines: parseKeyTimelines(keyTimelinesText),
    doubts: parseDoubts(doubtsText),
    evidenceCategories: parseEvidenceCategories(evidenceText),
  };
}

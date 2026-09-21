import type {
  ParsedChatRecord,
  ParseChatRecordResponse,
} from '@shared/api.interface';

export function parseChatText(text: string): ParseChatRecordResponse {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  const records: ParsedChatRecord[] = [];

  for (const line of lines) {
    const record = parseChatLine(line.trim());
    if (record) {
      records.push(record);
    }
  }

  return { records };
}

function parseChatLine(line: string): ParsedChatRecord | null {
  // [时间] 发送者: 内容 / 发送者：内容
  const bracketTimeMatch = line.match(
    /^\[([^\]]+)\]\s*([^:：]+)[:：]\s*(.+)$/,
  );
  if (bracketTimeMatch) {
    const timeStr = bracketTimeMatch[1].trim();
    const sender = bracketTimeMatch[2].trim();
    const content = bracketTimeMatch[3].trim();
    return { sender, content, sendTime: tryParseTime(timeStr) };
  }

  // YYYY-MM-DD HH:mm:ss 发送者:内容 / 发送者：内容
  const datetimeMatch = line.match(
    /^(\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2})?)\s+([^:：]+)[:：]\s*(.+)$/,
  );
  if (datetimeMatch) {
    const timeStr = datetimeMatch[1].trim().replace(' ', 'T');
    const sender = datetimeMatch[2].trim();
    const content = datetimeMatch[3].trim();
    return { sender, content, sendTime: tryParseTime(timeStr) };
  }

  // HH:mm:ss / HH:mm 发送者:内容
  const timeOnlyMatch = line.match(
    /^(\d{1,2}:\d{2}(?::\d{2})?)\s+([^:：]+)[:：]\s*(.+)$/,
  );
  if (timeOnlyMatch) {
    const timeStr = timeOnlyMatch[1].trim();
    const sender = timeOnlyMatch[2].trim();
    const content = timeOnlyMatch[3].trim();
    return { sender, content, sendTime: tryParseTime(timeStr) };
  }

  // 中文时间 (上午/下午/晚上/凌晨/中午)X:XX 发送者:内容
  const cnTimeMatch = line.match(
    /^(上午|下午|晚上|凌晨|中午)(\d{1,2})([：:](\d{1,2}))?\s+([^:：]+)[:：]\s*(.+)$/,
  );
  if (cnTimeMatch) {
    const period = cnTimeMatch[1];
    let hour = parseInt(cnTimeMatch[2], 10);
    const minute = cnTimeMatch[4] ? parseInt(cnTimeMatch[4], 10) : 0;
    const sender = cnTimeMatch[5].trim();
    const content = cnTimeMatch[6].trim();

    if (period === '下午' || period === '晚上') {
      if (hour < 12) hour += 12;
    } else if (period === '凌晨' && hour === 12) {
      hour = 0;
    }

    const now = new Date();
    const dateStr =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-` +
      `${String(now.getDate()).padStart(2, '0')}T` +
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    return { sender, content, sendTime: new Date(dateStr).toISOString() };
  }

  // 发送者: 内容 / 发送者：内容 (无时间)
  const senderOnlyMatch = line.match(/^([^:：]+)[:：]\s*(.+)$/);
  if (senderOnlyMatch) {
    const sender = senderOnlyMatch[1].trim();
    const content = senderOnlyMatch[2].trim();
    if (sender && content) {
      return { sender, content, sendTime: null };
    }
  }

  return null;
}

function tryParseTime(timeStr: string): string | null {
  const directDate = new Date(timeStr);
  if (!isNaN(directDate.getTime())) {
    return directDate.toISOString();
  }

  const hmsMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hmsMatch) {
    const hour = parseInt(hmsMatch[1], 10);
    const minute = parseInt(hmsMatch[2], 10);
    const second = hmsMatch[3] ? parseInt(hmsMatch[3], 10) : 0;
    const now = new Date();
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
      second,
    );
    return date.toISOString();
  }

  const withSpace = timeStr.replace(' ', 'T');
  const spacedDate = new Date(withSpace);
  if (!isNaN(spacedDate.getTime())) {
    return spacedDate.toISOString();
  }

  return null;
}

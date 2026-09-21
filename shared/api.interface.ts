export interface EventItem {
  id: string;
  eventTime: string;
  location: string | null;
  description: string;
  tags: string[];
  mediaCount: number;
  chatRecordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventDetail extends EventItem {
  media: EventMedia[];
  chatRecords: ChatRecord[];
}

export interface EventMedia {
  id: string;
  eventId: string;
  mediaType: 'image' | 'video';
  filePath: string;
  fileUrl: string;
  fileName: string | null;
  fileSize: number | null;
}

export interface ChatRecord {
  id: string;
  eventId: string;
  sender: string;
  content: string;
  sendTime: string | null;
}

export interface CreateEventRequest {
  eventTime: string;
  location?: string;
  description: string;
  tags: string[];
  media?: Array<{
    mediaType: 'image' | 'video';
    fileUrl: string;
    filePath?: string;
    fileName?: string;
    fileSize?: number;
  }>;
  chatRecords?: Array<{
    sender: string;
    content: string;
    sendTime?: string;
  }>;
  chatRecordText?: string;
}

export interface UpdateEventRequest {
  eventTime?: string;
  location?: string;
  description?: string;
  tags?: string[];
}

export interface EventListResponse {
  items: EventItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EventListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  location?: string;
  tag?: string;
  startTime?: string;
  endTime?: string;
}

export interface AnalysisReport {
  id: string;
  title: string;
  timeRangeStart: string | null;
  timeRangeEnd: string | null;
  summary: string;
  keyPersons: Array<{ name: string; role: string; mentions: number }>;
  keyTimelines: Array<{ time: string; event: string; importance: string }>;
  doubts: Array<{ point: string; description: string; severity: string }>;
  evidenceCategories: Array<{ category: string; items: string[] }>;
  fullReport: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnalysisRequest {
  title: string;
  startTime?: string;
  endTime?: string;
  eventIds?: string[];
}

export interface AnalysisReportListResponse {
  items: AnalysisReport[];
  total: number;
}

export interface ParseChatRecordRequest {
  text: string;
}

export interface ParsedChatRecord {
  sender: string;
  content: string;
  sendTime: string | null;
}

export interface ParseChatRecordResponse {
  records: ParsedChatRecord[];
}

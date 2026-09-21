import { http } from './index';
import type {
  EventDetail,
  EventListResponse,
  EventListQuery,
  CreateEventRequest,
  UpdateEventRequest,
  ParseChatRecordRequest,
  ParseChatRecordResponse,
} from '@shared/api.interface';

export async function getEvents(params?: EventListQuery): Promise<EventListResponse> {
  const response = await http.get('/events', { params });
  return response.data;
}

export async function getEvent(id: string): Promise<EventDetail> {
  const response = await http.get(`/events/${id}`);
  return response.data;
}

export async function createEvent(data: CreateEventRequest): Promise<EventDetail> {
  const response = await http.post('/events', data);
  return response.data;
}

export async function updateEvent(id: string, data: UpdateEventRequest): Promise<EventDetail> {
  const response = await http.patch(`/events/${id}`, data);
  return response.data;
}

export async function deleteEvent(id: string): Promise<void> {
  await http.delete(`/events/${id}`);
}

export async function parseChatRecord(text: string): Promise<ParseChatRecordResponse> {
  const response = await http.post('/events/parse-chat', { text } as ParseChatRecordRequest);
  return response.data;
}

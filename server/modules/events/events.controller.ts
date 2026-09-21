import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ParseChatRecordDto } from './dto/parse-chat.dto';
import { ListEventsDto } from './dto/list-events.dto';
import type {
  EventDetail,
  EventListResponse,
  ParseChatRecordResponse,
} from '@shared/api.interface';

@Controller('api/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async list(@Query() query: ListEventsDto): Promise<EventListResponse> {
    return this.eventsService.list({
      ...query,
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    });
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<EventDetail> {
    return this.eventsService.getById(id);
  }

  @Post()
  async create(@Body() dto: CreateEventDto): Promise<EventDetail> {
    return this.eventsService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ): Promise<EventDetail> {
    return this.eventsService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    await this.eventsService.delete(id);
  }

  @Post('parse-chat')
  async parseChat(
    @Body() dto: ParseChatRecordDto,
  ): Promise<ParseChatRecordResponse> {
    return this.eventsService.parseChat(dto.text);
  }
}

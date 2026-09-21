import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';
import type { UpdateEventRequest } from '@shared/api.interface';

export class UpdateEventDto implements UpdateEventRequest {
  @IsOptional()
  @IsDateString()
  eventTime?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

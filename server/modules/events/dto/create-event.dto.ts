import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import type { CreateEventRequest } from '@shared/api.interface';

class CreateEventMediaDto {
  @IsString()
  @IsIn(['image', 'video'])
  mediaType!: 'image' | 'video';

  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @IsOptional()
  @IsString()
  filePath?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;
}

class CreateChatRecordDto {
  @IsString()
  @IsNotEmpty()
  sender!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsDateString()
  sendTime?: string;
}

export class CreateEventDto implements CreateEventRequest {
  @IsDateString()
  eventTime!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsArray()
  @IsString({ each: true })
  tags!: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEventMediaDto)
  media?: CreateEventMediaDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChatRecordDto)
  chatRecords?: CreateChatRecordDto[];

  @IsOptional()
  @IsString()
  chatRecordText?: string;
}

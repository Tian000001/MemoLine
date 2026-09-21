import { IsString, IsArray, IsOptional, MaxLength, ArrayMaxSize } from 'class-validator';
import type { CreateAnalysisRequest } from '@shared/api.interface';

export class CreateAnalysisDto implements CreateAnalysisRequest {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  eventIds?: string[];
}

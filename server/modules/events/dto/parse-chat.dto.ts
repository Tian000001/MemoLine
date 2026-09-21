import { IsNotEmpty, IsString } from 'class-validator';
import type { ParseChatRecordRequest } from '@shared/api.interface';

export class ParseChatRecordDto implements ParseChatRecordRequest {
  @IsString()
  @IsNotEmpty()
  text!: string;
}

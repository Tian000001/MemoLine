import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { UPLOADS_DIR, MEDIA_BASE_URL } from './media.constants';

export interface UploadedMediaMeta {
  mediaType: 'image' | 'video';
  fileUrl: string;
  filePath: string;
  fileName: string;
  fileSize: number;
}

@Controller('api/media')
export class MediaController {
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          mkdirSync(UPLOADS_DIR, { recursive: true });
          cb(null, UPLOADS_DIR);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname) || '';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 200 * 1024 * 1024 },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File): UploadedMediaMeta {
    const mediaType: 'image' | 'video' = file.mimetype.startsWith('video/')
      ? 'video'
      : 'image';
    return {
      mediaType,
      fileUrl: `${MEDIA_BASE_URL}/${file.filename}`,
      filePath: file.filename,
      fileName: file.originalname,
      fileSize: file.size,
    };
  }
}

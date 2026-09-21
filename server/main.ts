import 'dotenv/config';
import 'tsconfig-paths/register';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import { AppModule } from './app.module';
import { UPLOADS_DIR } from './modules/media/media.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    abortOnError: process.env.NODE_ENV !== 'development',
  });

  const logger = new Logger('Bootstrap');
  const host = process.env.SERVER_HOST || 'localhost';
  const port = Number(process.env.SERVER_PORT || '3000');

  // 静态托管上传的媒体文件
  app.use('/api/media', express.static(UPLOADS_DIR));

  // 生产环境：托管已构建的前端（开发环境由 Vite 提供）
  const clientDist = join(process.cwd(), 'dist/client');
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(join(clientDist, 'index.html'));
      } else {
        next();
      }
    });
  }

  await app.listen(port, host);
  logger.log(`Server running on ${host}:${port}`);
  logger.log(`API endpoints ready at http://${host}:${port}/api`);
}

void bootstrap();

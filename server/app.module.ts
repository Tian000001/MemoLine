import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './modules/events/events.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { MediaModule } from './modules/media/media.module';

@Module({
  imports: [
    DatabaseModule,
    EventsModule,
    AnalysisModule,
    MediaModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}

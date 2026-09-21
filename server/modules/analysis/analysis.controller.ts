import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import type {
  AnalysisReport,
  AnalysisReportListResponse,
} from '@shared/api.interface';

@Controller('api/analysis/reports')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get()
  async getReports(): Promise<AnalysisReportListResponse> {
    return this.analysisService.getReportList();
  }

  @Get(':id')
  async getReport(@Param('id') id: string): Promise<AnalysisReport> {
    return this.analysisService.getReportDetail(id);
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidUnknownValues: true }))
  async createReport(@Body() dto: CreateAnalysisDto): Promise<AnalysisReport> {
    return this.analysisService.createReport(dto);
  }

  @Delete(':id')
  async deleteReport(@Param('id') id: string): Promise<void> {
    await this.analysisService.deleteReport(id);
  }
}

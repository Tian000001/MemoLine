"""分析复盘接口。"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks

from ..schemas import (
    AnalysisReport,
    AnalysisReportListResponse,
    CreateAnalysisRequest,
)
from ..services import analysis_service

router = APIRouter(prefix="/api/analysis/reports", tags=["analysis"])


@router.get("", response_model=AnalysisReportListResponse)
def get_reports() -> AnalysisReportListResponse:
    return analysis_service.get_report_list()


@router.get("/{report_id}", response_model=AnalysisReport)
def get_report(report_id: str) -> AnalysisReport:
    return analysis_service.get_report_detail(report_id)


@router.post("", response_model=AnalysisReport, status_code=201)
def create_report(
    dto: CreateAnalysisRequest, background_tasks: BackgroundTasks
) -> AnalysisReport:
    # 先返回 pending 记录，再由后台任务生成报告（前端 3 秒轮询刷新状态）。
    report = analysis_service.create_report(dto)
    background_tasks.add_task(analysis_service.generate_report, report.id, dto)
    return report


@router.delete("/{report_id}", status_code=204)
def delete_report(report_id: str) -> None:
    analysis_service.delete_report(report_id)

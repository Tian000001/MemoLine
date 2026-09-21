import { useEffect, useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Sparkles,
  CalendarRange,
  FileText,
  Copy,
  Download,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  ListChecks,
} from 'lucide-react';
import {
  getReports,
  getReport,
  createReport,
  deleteReport,
} from '@client/src/api/analysis';
import { getEvents } from '@client/src/api/events';
import type { AnalysisReport, EventItem } from '@shared/api.interface';
import ReportDetailPanel, { statusBadgeMap } from './ReportDetailPanel';

const POLL_INTERVAL = 3000;

const formatDateInput = (d: string | null): string => {
  if (!d) return '';
  return d.slice(0, 10);
};

const formatDateTime = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatTimeRange = (start: string | null, end: string | null): string => {
  const s = formatDateInput(start) || '不限';
  const e = formatDateInput(end) || '不限';
  return `${s} ~ ${e}`;
};

const AnalysisPage = () => {
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // 表单状态
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [showEventPicker, setShowEventPicker] = useState(false);

  // 展开的报告
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 轮询
  const pollingRef = useRef<Record<string, number | null>>({});

  const fetchReports = useCallback(async () => {
    try {
      const res = await getReports();
      setReports(res.items);
    } catch {
      toast.error('加载报告列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await getEvents({ pageSize: 50 });
      setEvents(res.items);
    } catch {
      // 忽略
    }
  }, []);

  useEffect(() => {
    void fetchReports();
    void fetchEvents();
  }, [fetchReports, fetchEvents]);

  // 轮询指定报告
  const startPolling = useCallback((reportId: string) => {
    if (pollingRef.current[reportId]) return;
    const tick = async () => {
      try {
        const updated = await getReport(reportId);
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? updated : r)),
        );
        if (updated.status === 'completed' || updated.status === 'failed') {
          stopPolling(reportId);
          if (updated.status === 'completed') {
            toast.success('报告生成完成');
          } else {
            toast.error('报告生成失败');
          }
          return;
        }
      } catch {
        // 忽略轮询错误
      }
      pollingRef.current[reportId] = window.setTimeout(tick, POLL_INTERVAL);
    };
    pollingRef.current[reportId] = window.setTimeout(tick, POLL_INTERVAL);
  }, []);

  const stopPolling = (reportId: string) => {
    const timer = pollingRef.current[reportId];
    if (timer) {
      clearTimeout(timer);
      pollingRef.current[reportId] = null;
    }
  };

  // 初始：对 pending/generating 的报告启动轮询
  useEffect(() => {
    reports.forEach((r) => {
      if (r.status === 'pending' || r.status === 'generating') {
        startPolling(r.id);
      }
    });
    return () => {
      Object.keys(pollingRef.current).forEach((id) => stopPolling(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPolling]);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('请输入报告标题');
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      toast.error('开始时间不能晚于结束时间');
      return;
    }
    setCreating(true);
    try {
      const newReport = await createReport({
        title: title.trim(),
        startTime: startDate || undefined,
        endTime: endDate || undefined,
        eventIds: selectedEventIds.length > 0 ? selectedEventIds : undefined,
      });
      setReports((prev) => [newReport, ...prev]);
      setExpandedId(newReport.id);
      toast.success('已提交分析，正在生成中...');
      // 启动轮询
      startPolling(newReport.id);
      // 重置表单
      setTitle('');
      setStartDate('');
      setEndDate('');
      setSelectedEventIds([]);
      setShowEventPicker(false);
    } catch {
      toast.error('创建报告失败，请重试');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleExpand = async (report: AnalysisReport) => {
    const nextId = expandedId === report.id ? null : report.id;
    setExpandedId(nextId);
    // 如果未完整加载，补充一次详情
    if (nextId && report.status === 'completed' && !report.summary) {
      try {
        const full = await getReport(report.id);
        setReports((prev) => prev.map((r) => (r.id === report.id ? full : r)));
      } catch {
        // 忽略
      }
    }
  };

  const handleCopy = async (report: AnalysisReport, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = report.fullReport || report.summary || '';
    if (!text) {
      toast.error('报告内容为空');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制到剪贴板');
    } catch {
      toast.error('复制失败');
    }
  };

  const handleExport = (report: AnalysisReport, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = report.fullReport || report.summary || '';
    if (!text) {
      toast.error('报告内容为空');
      return;
    }
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('已导出报告');
    } catch {
      toast.error('导出失败');
    }
  };

  const handleDelete = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('确定要删除这份报告吗？')) return;
    try {
      await deleteReport(reportId);
      stopPolling(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      if (expandedId === reportId) setExpandedId(null);
      toast.success('已删除报告');
    } catch {
      toast.error('删除失败');
    }
  };

  const toggleEvent = (id: string) => {
    setSelectedEventIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-100">
          智能复盘分析
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          选择时间范围或指定事件，AI 将自动生成结构化复盘报告
        </p>
      </div>

      {/* 创建分析报告 */}
      <div
        data-ai-section-type="card-stat"
        className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5 backdrop-blur-sm"
      >
        <h3 className="mb-4 flex items-center gap-2 text-base font-medium text-slate-200">
          <Sparkles size={16} className="text-cyan-400" />
          创建分析报告
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm text-slate-400">报告标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入报告标题"
              className="w-full rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm text-slate-400">时间范围</label>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>
              <span className="text-slate-500">至</span>
              <div className="flex-1">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 事件选择器 */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowEventPicker(!showEventPicker)}
            className="flex items-center gap-2 text-sm text-cyan-400 transition-colors hover:text-cyan-300"
          >
            <ListChecks size={14} />
            指定事件（可选）
            {selectedEventIds.length > 0 && (
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs">
                已选 {selectedEventIds.length}
              </span>
            )}
            {showEventPicker ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {showEventPicker && (
            <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-slate-700/50 bg-slate-900/40 p-2">
              {events.length === 0 ? (
                <p className="p-3 text-center text-sm text-slate-500">暂无事件</p>
              ) : (
                events.map((ev) => (
                  <label
                    key={ev.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 transition-colors hover:bg-slate-800/60"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEventIds.includes(ev.id)}
                      onChange={() => toggleEvent(ev.id)}
                      className="mt-1 size-4 accent-cyan-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-200">{ev.description}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDateInput(ev.eventTime)}
                        {ev.location ? ` · ${ev.location}` : ''}
                      </p>
                    </div>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="mt-5 flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-cyan-400 disabled:opacity-50"
        >
          {creating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {creating ? '分析生成中...' : '开始智能分析'}
        </button>
      </div>

      {/* 历史报告列表 */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-base font-medium text-slate-200">
          <FileText size={16} className="text-cyan-400" />
          历史报告
          {reports.length > 0 && (
            <span className="text-xs font-normal text-slate-500">({reports.length})</span>
          )}
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={24} className="animate-spin text-cyan-400" />
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-800/30 py-12 text-center">
            <FileText size={28} className="mx-auto text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">暂无分析报告</p>
            <p className="mt-1 text-xs text-slate-500">填写表单创建第一份复盘报告</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => {
              const badge = statusBadgeMap[report.status];
              const isExpanded = expandedId === report.id;
              const isGenerating =
                report.status === 'pending' || report.status === 'generating';
              return (
                <div
                  key={report.id}
                  className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(report)}
                    className="flex w-full flex-col gap-3 p-5 text-left transition-colors hover:bg-slate-700/20 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-medium text-slate-200">
                          {report.title}
                        </h4>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <CalendarRange size={12} />
                          <span>
                            {formatTimeRange(report.timeRangeStart, report.timeRangeEnd)}
                          </span>
                          <span>·</span>
                          <span>{formatDateTime(report.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
                        {isGenerating && (
                          <Loader2 size={11} className="mr-1 inline animate-spin align-[-1px]" />
                        )}
                        {badge.label}
                      </span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleCopy(report, e)}
                          disabled={report.status !== 'completed'}
                          title="复制报告"
                          className="flex items-center gap-1 rounded-lg border border-slate-700/50 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700/40 disabled:opacity-40"
                        >
                          <Copy size={12} />
                          复制
                        </button>
                        <button
                          onClick={(e) => handleExport(report, e)}
                          disabled={report.status !== 'completed'}
                          title="导出报告"
                          className="flex items-center gap-1 rounded-lg border border-slate-700/50 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700/40 disabled:opacity-40"
                        >
                          <Download size={12} />
                          导出
                        </button>
                        <button
                          onClick={(e) => handleDelete(report.id, e)}
                          title="删除报告"
                          className="flex items-center gap-1 rounded-lg border border-slate-700/50 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 size={12} />
                          删除
                        </button>
                      </div>
                      {isExpanded ? (
                        <ChevronDown size={16} className="text-slate-400" />
                      ) : (
                        <ChevronUp size={16} className="text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* 展开详情 */}
                  {isExpanded && (
                    <div className="border-t border-slate-700/40 bg-slate-900/30 p-5">
                      <ReportDetailPanel report={report} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPage;

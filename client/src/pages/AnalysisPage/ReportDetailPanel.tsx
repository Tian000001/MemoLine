import { useState } from 'react';
import {
  Users,
  Clock,
  AlertTriangle,
  FolderOpen,
  FileText,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { AnalysisReport } from '@shared/api.interface';

interface ReportDetailPanelProps {
  report: AnalysisReport;
}

const statusBadgeMap: Record<AnalysisReport['status'], { label: string; className: string }> = {
  pending: { label: '等待中', className: 'bg-slate-500/15 text-slate-400' },
  generating: { label: '生成中', className: 'bg-blue-500/15 text-blue-400' },
  completed: { label: '已完成', className: 'bg-emerald-500/15 text-emerald-400' },
  failed: { label: '失败', className: 'bg-red-500/15 text-red-400' },
};

const severityBadgeClass = (severity: string): string => {
  const s = severity.toLowerCase();
  if (s.includes('high') || s.includes('严重') || s === '高') return 'bg-red-500/15 text-red-400';
  if (s.includes('medium') || s.includes('中等') || s === '中') return 'bg-amber-500/15 text-amber-400';
  return 'bg-slate-500/15 text-slate-400';
};

const severityCardClass = (severity: string): string => {
  const s = severity.toLowerCase();
  if (s.includes('high') || s.includes('严重') || s === '高') return 'border-red-500/30';
  if (s.includes('medium') || s.includes('中等') || s === '中') return 'border-amber-500/30';
  return 'border-slate-600/30';
};

const importanceDot = (importance: string): string => {
  const i = importance.toLowerCase();
  if (i.includes('high') || i.includes('重要') || i === '高') return 'bg-red-400';
  if (i.includes('medium') || i.includes('中等') || i === '中') return 'bg-amber-400';
  return 'bg-slate-500';
};

function EvidenceCategory({ category, items }: { category: string; items: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-slate-700/40 bg-slate-900/40">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-200 transition-colors hover:bg-slate-700/20"
      >
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        <FolderOpen size={14} className="text-cyan-400" />
        <span className="font-medium">{category}</span>
        <span className="ml-auto text-xs text-slate-500">{items.length} 条</span>
      </button>
      {open && (
        <ul className="border-t border-slate-700/40 px-4 py-3 space-y-2">
          {items.map((item: string, idx: number) => (
            <li key={idx} className="flex gap-2 text-sm text-slate-300 leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/60" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ReportDetailPanel = ({ report }: ReportDetailPanelProps) => {
  const [fullOpen, setFullOpen] = useState(false);
  const badge = statusBadgeMap[report.status];
  const isGenerating = report.status === 'pending' || report.status === 'generating';
  const isFailed = report.status === 'failed';
  const hasContent = report.status === 'completed';

  return (
    <div className="space-y-5">
      {/* 头部状态 */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-700/40 pb-4">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
          {isGenerating && <Loader2 size={11} className="mr-1 inline animate-spin align-[-1px]" />}
          {badge.label}
        </span>
        {isGenerating && (
          <span className="text-xs text-slate-500">AI 正在分析事件链，请稍候...</span>
        )}
        {isFailed && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <XCircle size={12} /> 生成失败，请重试
          </span>
        )}
        {hasContent && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 size={12} /> 分析完成
          </span>
        )}
      </div>

      {/* 生成中占位 */}
      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Loader2 size={28} className="animate-spin text-cyan-400" />
          <p className="mt-3 text-sm text-slate-300">正在生成复盘报告</p>
          <p className="mt-1 text-xs text-slate-500">大模型正在梳理事件脉络，通常需要 10-30 秒</p>
        </div>
      )}

      {/* 失败占位 */}
      {isFailed && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <XCircle size={28} className="text-red-400" />
          <p className="mt-3 text-sm text-slate-300">报告生成失败</p>
          <p className="mt-1 text-xs text-slate-500">请检查事件数据后重新生成</p>
        </div>
      )}

      {/* 完成时的结构化内容 */}
      {hasContent && (
        <>
          {/* 事件整体摘要 */}
          <section>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
              <FileText size={14} className="text-cyan-400" />
              事件整体摘要
            </h4>
            <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-4">
              <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                {report.summary || '暂无摘要'}
              </p>
            </div>
          </section>

          {/* 关键人物 */}
          {report.keyPersons && report.keyPersons.length > 0 && (
            <section>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
                <Users size={14} className="text-cyan-400" />
                关键人物
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {report.keyPersons.map((person, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-slate-700/40 bg-slate-900/40 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-200">{person.name}</p>
                      <p className="text-xs text-slate-500">{person.role}</p>
                    </div>
                    <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs text-cyan-400">
                      提及 {person.mentions} 次
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 关键时间节点 */}
          {report.keyTimelines && report.keyTimelines.length > 0 && (
            <section>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
                <Clock size={14} className="text-cyan-400" />
                关键时间节点
              </h4>
              <div className="relative pl-5">
                <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-700/60" />
                <div className="space-y-4">
                  {report.keyTimelines.map((item, idx) => (
                    <div key={idx} className="relative">
                      <span
                        className={`absolute -left-5 top-1.5 h-3 w-3 rounded-full border-2 border-slate-800 ${importanceDot(item.importance)}`}
                      />
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-xs font-medium text-cyan-400">{item.time}</span>
                        <span className="text-xs text-slate-500">· {item.importance}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-300 leading-relaxed">{item.event}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* 疑点识别 */}
          {report.doubts && report.doubts.length > 0 && (
            <section>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
                <AlertTriangle size={14} className="text-cyan-400" />
                疑点识别
              </h4>
              <div className="space-y-2">
                {report.doubts.map((doubt, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border bg-slate-900/40 p-4 ${severityCardClass(doubt.severity)}`}
                  >
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-medium text-slate-200">{doubt.point}</h5>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${severityBadgeClass(doubt.severity)}`}>
                        {doubt.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed">{doubt.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 证据归类 */}
          {report.evidenceCategories && report.evidenceCategories.length > 0 && (
            <section>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
                <FolderOpen size={14} className="text-cyan-400" />
                证据归类
              </h4>
              <div className="space-y-2">
                {report.evidenceCategories.map((cat, idx) => (
                  <EvidenceCategory key={idx} category={cat.category} items={cat.items} />
                ))}
              </div>
            </section>
          )}

          {/* 完整报告 */}
          <section>
            <button
              type="button"
              onClick={() => setFullOpen(!fullOpen)}
              className="flex w-full items-center gap-2 rounded-lg border border-slate-700/40 bg-slate-900/40 px-4 py-3 text-left text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/20"
            >
              {fullOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
              <FileText size={14} className="text-cyan-400" />
              完整报告
            </button>
            {fullOpen && (
              <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-700/40 bg-slate-900/60 p-4">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300 font-sans">
                  {report.fullReport || '暂无完整报告'}
                </pre>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export { statusBadgeMap };
export default ReportDetailPanel;

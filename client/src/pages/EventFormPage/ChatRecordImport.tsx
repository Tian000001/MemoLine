import { useState } from 'react';
import { RefreshCw, Loader2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { parseChatRecord } from '@client/src/api/events';
import type {
  ChatRecord,
  ParsedChatRecord,
} from '@shared/api.interface';

interface ChatRecordImportProps {
  existingRecords?: ChatRecord[];
  confirmedRecords: ParsedChatRecord[];
  chatText: string;
  onChatTextChange: (text: string) => void;
  onConfirm: (records: ParsedChatRecord[]) => void;
  onClear: () => void;
  readOnly?: boolean;
}

const ChatRecordImport = ({
  existingRecords = [],
  confirmedRecords,
  chatText,
  onChatTextChange,
  onConfirm,
  onClear,
  readOnly = false,
}: ChatRecordImportProps) => {
  const [parsing, setParsing] = useState(false);
  const [parsedRecords, setParsedRecords] = useState<ParsedChatRecord[]>([]);
  const [showParsePreview, setShowParsePreview] = useState(false);

  const allRecords = [
    ...existingRecords.map((r) => ({ ...r, source: 'existing' as const })),
    ...confirmedRecords.map((r) => ({
      id: `new-${r.sender}-${r.sendTime}-${r.content.slice(0, 10)}`,
      eventId: '',
      sender: r.sender,
      content: r.content,
      sendTime: r.sendTime,
      source: 'new' as const,
    })),
  ];

  const handleParse = async (): Promise<void> => {
    if (!chatText.trim()) {
      toast.warning('请先粘贴聊天记录文本');
      return;
    }
    setParsing(true);
    try {
      const result = await parseChatRecord(chatText);
      setParsedRecords(result.records);
      setShowParsePreview(true);
      if (result.records.length === 0) {
        toast.warning('未解析到任何聊天记录');
      }
    } catch {
      toast.error('解析聊天记录失败');
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmParse = (): void => {
    onConfirm(parsedRecords);
    setShowParsePreview(false);
    toast.success(`已确认 ${parsedRecords.length} 条聊天记录`);
  };

  const handleCancelParse = (): void => {
    setShowParsePreview(false);
    setParsedRecords([]);
  };

  return (
    <div>
      {allRecords.length > 0 && (
        <div className="mb-4 max-h-64 space-y-3 overflow-y-auto rounded-lg bg-slate-900/40 p-3">
          {allRecords.map((r) => (
            <div key={r.id} className="flex gap-2 text-sm">
              <div className="w-20 shrink-0 truncate font-medium text-cyan-400">
                {r.sender}
              </div>
              <div className="flex-1">
                <p className="break-words text-slate-300">{r.content}</p>
                {r.sendTime && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {new Date(r.sendTime).toLocaleString('zh-CN')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(!readOnly || allRecords.length === 0) && (
        <>
          <textarea
            rows={6}
            value={chatText}
            onChange={(e) => onChatTextChange(e.target.value)}
            placeholder="粘贴聊天记录文本，系统将自动识别发送者和内容..."
            className="w-full resize-none rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
          />
          <p className="mt-2 text-xs text-slate-500">
            支持常见聊天格式，自动识别发送者、时间和内容
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleParse}
              disabled={parsing || !chatText.trim()}
              className="flex items-center gap-2 rounded-lg bg-slate-700/60 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              {parsing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              解析预览
            </button>
            {confirmedRecords.length > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="rounded-lg border border-slate-700/50 px-4 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
              >
                清除聊天记录
              </button>
            )}
          </div>
        </>
      )}

      {readOnly && existingRecords.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          编辑模式下仅展示已有聊天记录
        </p>
      )}

      {showParsePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700/50 p-4">
              <h4 className="text-base font-medium text-slate-200">
                解析预览 ({parsedRecords.length} 条)
              </h4>
              <button
                type="button"
                onClick={handleCancelParse}
                className="text-slate-400 transition-colors hover:text-slate-200"
                aria-label="关闭"
              >
                <X size={20} />
              </button>
            </div>
            <div className="max-h-96 space-y-3 overflow-y-auto p-4">
              {parsedRecords.length === 0 ? (
                <p className="text-center text-sm text-slate-500">
                  未解析到聊天记录
                </p>
              ) : (
                parsedRecords.map((r: ParsedChatRecord, i: number) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <div className="w-20 shrink-0 truncate font-medium text-cyan-400">
                      {r.sender}
                    </div>
                    <div className="flex-1">
                      <p className="break-words text-slate-300">{r.content}</p>
                      {r.sendTime && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {new Date(r.sendTime).toLocaleString('zh-CN')}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-700/50 p-4">
              <button
                type="button"
                onClick={handleCancelParse}
                className="rounded-lg border border-slate-700/50 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700/60"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmParse}
                disabled={parsedRecords.length === 0}
                className="flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-cyan-400 disabled:opacity-50"
              >
                <Check size={16} />
                确认使用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatRecordImport;

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Image as ImageIcon,
  MessageSquare,
  Tag,
  MapPin,
  Clock,
  X,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { createEvent, updateEvent, getEvent } from '@client/src/api/events';
import type { EventDetail, ParsedChatRecord } from '@shared/api.interface';
import MediaUpload, {
  type MediaUploadItem,
} from './MediaUpload';
import ChatRecordImport from './ChatRecordImport';

const formatDateTimeLocal = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EventFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // form fields
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  // tags
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // media
  const [media, setMedia] = useState<MediaUploadItem[]>([]);
  const [existingMedia, setExistingMedia] = useState<EventDetail['media']>([]);

  // chat records
  const [chatText, setChatText] = useState('');
  const [confirmedRecords, setConfirmedRecords] = useState<ParsedChatRecord[]>([]);
  const [existingChatRecords, setExistingChatRecords] = useState<
    EventDetail['chatRecords']
  >([]);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const data = await getEvent(id);
        if (cancelled) return;
        setEventTime(formatDateTimeLocal(data.eventTime));
        setLocation(data.location ?? '');
        setDescription(data.description);
        setTags(data.tags ?? []);
        setExistingMedia(data.media ?? []);
        setExistingChatRecords(data.chatRecords ?? []);
      } catch {
        toast.error('加载事件详情失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isEdit, id]);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = tagInput.trim();
    if (!value) return;
    if (tags.includes(value)) {
      toast.warning('标签已存在');
      return;
    }
    setTags([...tags, value]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string): void => {
    setTags(tags.filter((t: string) => t !== tagToRemove));
  };

  const handleClearChatRecords = (): void => {
    setConfirmedRecords([]);
    setChatText('');
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!eventTime) {
      toast.error('请选择日期时间');
      return;
    }
    if (!description.trim()) {
      toast.error('请填写事件描述');
      return;
    }

    setSubmitting(true);
    try {
      const eventTimeIso = new Date(eventTime).toISOString();

      if (isEdit && id) {
        await updateEvent(id, {
          eventTime: eventTimeIso,
          location: location || undefined,
          description: description.trim(),
          tags,
        });
        toast.success('事件更新成功');
      } else {
        await createEvent({
          eventTime: eventTimeIso,
          location: location || undefined,
          description: description.trim(),
          tags,
          media: media.map((m: MediaUploadItem) => ({
            mediaType: m.mediaType,
            fileUrl: m.fileUrl,
            fileName: m.fileName,
            fileSize: m.fileSize,
          })),
          chatRecords:
            confirmedRecords.length > 0
              ? confirmedRecords.map((r: ParsedChatRecord) => ({
                  sender: r.sender,
                  content: r.content,
                  sendTime: r.sendTime ?? undefined,
                }))
              : undefined,
          chatRecordText: chatText || undefined,
        });
        toast.success('事件创建成功');
      }

      navigate('/');
    } catch {
      toast.error('保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && isEdit) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/50 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-100">
            {isEdit ? '编辑事件' : '新建事件'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            记录事件的时间、地点、描述和相关素材
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基础信息 */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5 backdrop-blur-sm">
          <h3 className="mb-4 flex items-center gap-2 text-base font-medium text-slate-200">
            <Clock size={16} className="text-cyan-400" />
            基础信息
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-slate-400">
                日期时间 *
              </label>
              <input
                type="datetime-local"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-slate-400">地点</label>
              <div className="relative">
                <MapPin
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  size={14}
                />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="输入事件发生地点"
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-900/60 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-sm text-slate-400">
              事件描述 *
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="详细描述事件经过..."
              className="w-full resize-none rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
        </div>

        {/* 标签 */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5 backdrop-blur-sm">
          <h3 className="mb-4 flex items-center gap-2 text-base font-medium text-slate-200">
            <Tag size={16} className="text-cyan-400" />
            标签
          </h3>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder="输入标签，按回车添加"
            className="w-full rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
          />
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-700/80 px-2 py-0.5 text-xs text-slate-300"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-slate-400 transition-colors hover:text-slate-200"
                    aria-label={`删除标签 ${tag}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 媒体上传 */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5 backdrop-blur-sm">
          <h3 className="mb-4 flex items-center gap-2 text-base font-medium text-slate-200">
            <ImageIcon size={16} className="text-cyan-400" />
            媒体上传
          </h3>
          <MediaUpload
            existingMedia={existingMedia}
            media={media}
            onChange={setMedia}
            readOnly={isEdit}
          />
        </div>

        {/* 聊天记录导入 */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5 backdrop-blur-sm">
          <h3 className="mb-4 flex items-center gap-2 text-base font-medium text-slate-200">
            <MessageSquare size={16} className="text-cyan-400" />
            聊天记录导入
          </h3>
          <ChatRecordImport
            existingRecords={existingChatRecords}
            confirmedRecords={confirmedRecords}
            chatText={chatText}
            onChatTextChange={setChatText}
            onConfirm={setConfirmedRecords}
            onClear={handleClearChatRecords}
            readOnly={isEdit}
          />
        </div>

        {/* 提交按钮 */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-700/50 px-5 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-cyan-400 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {submitting ? '保存中...' : isEdit ? '更新事件' : '保存事件'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EventFormPage;

import {
  Image as ImageIcon,
  Play,
  User,
  Calendar as CalendarIcon,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import Image from '@/components/ui/image';

import type { EventDetail } from '@shared/api.interface';

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDateLabel(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function SkeletonNode() {
  return (
    <div className="relative pl-10">
      <div className="absolute left-2 top-3 h-4 w-4 rounded-full border-2 border-slate-600 bg-slate-800" />
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-5">
        <div className="flex gap-3">
          <Skeleton className="h-4 w-28 bg-slate-700/50" />
          <Skeleton className="h-4 w-32 bg-slate-700/50" />
        </div>
        <Skeleton className="mt-3 h-4 w-full bg-slate-700/50" />
        <Skeleton className="mt-2 h-4 w-3/4 bg-slate-700/50" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full bg-slate-700/50" />
          <Skeleton className="h-5 w-16 rounded-full bg-slate-700/50" />
        </div>
      </div>
    </div>
  );
}

interface DatePickerFieldProps {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
  placeholder: string;
}

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder,
}: DatePickerFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-slate-400">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start border-slate-700/50 bg-slate-900/60 text-left text-sm font-normal text-slate-300 hover:border-slate-600 hover:bg-slate-800"
          >
            <CalendarIcon size={14} className="mr-2 text-slate-500" />
            {value ? formatDateLabel(value) : placeholder}
            {value && (
              <X
                size={14}
                className="ml-auto text-slate-500 hover:text-slate-300"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto border-slate-700/50 bg-slate-800 p-0">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={(d) => onChange(d ?? null)}
            initialFocus
            className="bg-slate-800 text-slate-200"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface EventDetailViewProps {
  detail: EventDetail;
}

export function EventDetailView({ detail }: EventDetailViewProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-1.5 text-xs font-medium text-slate-400">事件描述</h4>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
          {detail.description}
        </p>
      </div>

      {detail.media.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-slate-400">媒体资料</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {detail.media.map((m) => (
              <div
                key={m.id}
                className="relative aspect-video overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/60"
              >
                {m.mediaType === 'image' && m.fileUrl ? (
                  <Image
                    src={m.fileUrl}
                    alt={m.fileName ?? '媒体图片'}
                    width={200}
                    height={150}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-500">
                    {m.mediaType === 'video' ? <Play size={20} /> : <ImageIcon size={20} />}
                    <span className="max-w-full truncate px-1 text-[10px]">
                      {m.fileName ?? m.mediaType}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {detail.chatRecords.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-slate-400">
            聊天记录（{detail.chatRecords.length} 条）
          </h4>
          <div className="space-y-2 rounded-lg bg-slate-900/40 p-3">
            {detail.chatRecords.map((cr) => (
              <div key={cr.id} className="flex items-start gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-300">
                  <User size={12} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-cyan-400">
                      {cr.sender}
                    </span>
                    {cr.sendTime && (
                      <span className="text-[10px] text-slate-500">
                        {formatDateTime(cr.sendTime)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 inline-block max-w-full rounded-lg rounded-tl-sm bg-slate-700/60 px-3 py-1.5 text-sm text-slate-200">
                    <span className="break-words whitespace-pre-wrap">
                      {cr.content}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef } from 'react';
import { Upload, Loader2, X, Image as ImageIcon, Play } from 'lucide-react';
import { toast } from 'sonner';
import { http } from '@client/src/api';
import type { EventMedia } from '@shared/api.interface';

export interface MediaUploadItem {
  mediaType: 'image' | 'video';
  filePath: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  previewUrl: string;
}

interface MediaUploadProps {
  existingMedia?: EventMedia[];
  media: MediaUploadItem[];
  onChange: (media: MediaUploadItem[]) => void;
  readOnly?: boolean;
}

const MediaUpload = ({
  existingMedia = [],
  media,
  onChange,
  readOnly = false,
}: MediaUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newItems: MediaUploadItem[] = [];

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');
        if (!isVideo && !isImage) {
          toast.warning(`${file.name} 不是图片或视频，已跳过`);
          continue;
        }

        const form = new FormData();
        form.append('file', file);

        try {
          const { data } = await http.post('/media/upload', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          newItems.push({
            mediaType: data.mediaType,
            filePath: data.filePath,
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileSize: data.fileSize,
            previewUrl: data.fileUrl,
          });
        } catch {
          toast.error(`${file.name} 上传失败`);
        }
      }

      onChange([...media, ...newItems]);
      if (newItems.length > 0) {
        toast.success(`成功上传 ${newItems.length} 个文件`);
      }
    } catch {
      toast.error('文件上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = (index: number): void => {
    onChange(media.filter((_: MediaUploadItem, i: number) => i !== index));
  };

  const allMedia = [
    ...existingMedia.map((m: EventMedia) => ({
      type: 'existing' as const,
      mediaType: m.mediaType,
      previewUrl: m.fileUrl ?? '',
      fileName: m.fileName ?? '',
    })),
    ...media.map((m: MediaUploadItem) => ({
      type: 'new' as const,
      mediaType: m.mediaType,
      previewUrl: m.previewUrl,
      fileName: m.fileName,
    })),
  ];

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      {!readOnly && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex h-32 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700/60 bg-slate-900/30 text-sm text-slate-400 transition-colors hover:border-cyan-500/50 hover:text-cyan-400 disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              上传中...
            </>
          ) : (
            <>
              <Upload size={20} />
              点击上传图片/视频
            </>
          )}
        </button>
      )}

      {allMedia.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {allMedia.map(
            (
              m: {
                type: 'existing' | 'new';
                mediaType: 'image' | 'video';
                previewUrl: string;
                fileName: string;
              },
              idx: number,
            ) => (
              <div
                key={m.type === 'existing' ? `exist-${idx}` : `new-${idx}`}
                className="group relative aspect-square overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/60"
              >
                {m.mediaType === 'image' ? (
                  m.previewUrl ? (
                    <img
                      src={m.previewUrl}
                      alt={m.fileName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon size={24} className="text-slate-600" />
                    </div>
                  )
                ) : (
                  <div className="flex h-full items-center justify-center bg-slate-900">
                    <Play size={28} className="text-slate-500" />
                  </div>
                )}
                {m.type === 'new' && (
                  <button
                    type="button"
                    onClick={() => handleRemove(idx - existingMedia.length)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="删除"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ),
          )}
        </div>
      )}

      {readOnly && existingMedia.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          编辑模式下仅展示已有媒体
        </p>
      )}
    </div>
  );
};

export default MediaUpload;

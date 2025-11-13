"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconDownload, IconVideo, IconPhoto, IconLoader2 } from "@tabler/icons-react";
import { useLargeMediaLoad } from "@/hooks/useLargeMediaLoad";

interface OversizedMediaPlaceholderProps {
  mediaId: string;
  postId: string;
  mediaType: "image" | "video" | "gif";
  fileSizeBytes: number;
  onLoad?: (newUrl: string) => void;
}

export function OversizedMediaPlaceholder({
  mediaId,
  postId,
  mediaType,
  fileSizeBytes,
  onLoad,
}: OversizedMediaPlaceholderProps) {
  const loadMediaMutation = useLargeMediaLoad({
    postId,
    mediaId,
    onSuccess: onLoad,
  });

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} МБ`;
  };

  const Icon = mediaType === "video" ? IconVideo : IconPhoto;

  return (
    <Card className="relative w-full aspect-video bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center gap-4 p-6">
      <div className="absolute top-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded">
        {formatFileSize(fileSizeBytes)}
      </div>

      <Icon className="w-16 h-16 text-gray-400" />

      <div className="text-center space-y-2">
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
          Медиафайл весит больше 200 МБ
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Файл не был загружен автоматически для экономии ресурсов
        </p>
      </div>

      {loadMediaMutation.isError && (
        <p className="text-sm text-red-600 dark:text-red-400 max-w-md text-center">
          {loadMediaMutation.error?.message || "Ошибка загрузки медиафайла"}
        </p>
      )}

      <Button
        onClick={() => loadMediaMutation.mutate()}
        disabled={loadMediaMutation.isPending}
        className="gap-2"
        size="lg"
      >
        {loadMediaMutation.isPending ? (
          <>
            <IconLoader2 className="w-4 h-4 animate-spin" />
            Загрузка...
          </>
        ) : (
          <>
            <IconDownload className="w-4 h-4" />
            Загрузить файл
          </>
        )}
      </Button>

      {loadMediaMutation.isPending && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Это может занять несколько минут...
        </p>
      )}
    </Card>
  );
}


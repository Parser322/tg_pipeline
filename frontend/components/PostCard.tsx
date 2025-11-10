import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { Post, MediaItem } from '@/types/api';
import { Eye, Star, Languages, Trash2, MessageSquare, Sparkles, Smile, ChevronDown, Calendar } from 'lucide-react';
import { formatPostDate } from '@/lib/dateUtils';

type PostCardProps = {
  post: Post;
  onTranslate: (postId: string, targetLang: string) => void;
  onDelete: (postId: string) => void;
};

function isVideoMedia(m: MediaItem): boolean {
  if (m.media_type === 'video') return true;
  if ((m.mime_type || '').toLowerCase().startsWith('video/')) return true;
  const url = (m.url || '').toLowerCase();
  return url.endsWith('.mp4') || url.endsWith('.mov') || url.endsWith('.mkv') || url.endsWith('.webm') || url.endsWith('.m4v');
}

function isGifMedia(m: MediaItem): boolean {
  if ((m.mime_type || '').toLowerCase() === 'image/gif') return true;
  return m.url.toLowerCase().endsWith('.gif');
}

export default function PostCard({ post, onTranslate, onDelete }: PostCardProps) {
  const [activeTab, setActiveTab] = useState<'original' | 'translated'>('original');
  
  const firstMedia = useMemo(
    () => (post.media && post.media.length > 0 ? post.media[0] : undefined),
    [post.media]
  );

  const handleDeleteClick = useCallback(() => {
    const confirmed = window.confirm('Вы уверены, что хотите удалить этот пост?');
    if (confirmed) {
      onDelete(post.id);
    }
  }, [post.id, onDelete]);

  const handleTranslateClick = useCallback(() => {
    onTranslate(post.id, 'EN');
  }, [post.id, onTranslate]);

  const formattedDate = useMemo(() => formatPostDate(post.original_date), [post.original_date]);

  return (
    <Card className='hover:shadow-md transition-shadow rounded-lg'>
      <CardContent className='p-4 space-y-3'>
        <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3'>
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-semibold truncate'>{post.source_channel}</p>
            <div className='flex items-center gap-2 mt-0.5'>
              <p className='text-xs text-muted-foreground'>ID: {post.original_message_id}</p>
              {formattedDate && (
                <>
                  <span className='text-xs text-muted-foreground'>•</span>
                  <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                    <Calendar className='h-3 w-3' />
                    <span>{formattedDate}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className='mt-1 sm:mt-0 flex items-center gap-1 sm:gap-2 shrink-0'>
            {post.is_top_post && (
              <Badge
                variant='secondary'
                className='text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1 whitespace-nowrap'
              >
                <Star className='h-3.5 w-3.5 text-yellow-500' />
              </Badge>
            )}
          </div>
        </div>
        {firstMedia ? (
          <div className='relative h-64 md:h-80 3xl:h-96 rounded-md overflow-hidden border bg-muted'>
            {isVideoMedia(firstMedia) ? (
              <video
                src={firstMedia.url}
                controls
                preload='metadata'
                className='w-full h-full object-contain bg-black'
              />
            ) : (
              <Image
                src={firstMedia.url}
                alt={`Media from ${post.source_channel}`}
                fill
                className='object-contain'
                loading='lazy'
                unoptimized={isGifMedia(firstMedia)}
                sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
                priority={false}
              />
            )}
          </div>
        ) : null}
        <div className='space-y-2'>
          <div role='tablist' aria-label='Текст поста' className='flex items-center gap-1 pb-1'>
            <button
              role='tab'
              aria-selected={activeTab === 'original'}
              onClick={() => setActiveTab('original')}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                activeTab === 'original'
                  ? 'bg-secondary text-secondary-foreground border-transparent'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              Оригинал
            </button>
            <button
              role='tab'
              aria-selected={activeTab === 'translated'}
              onClick={() => post.translated_content && setActiveTab('translated')}
              disabled={!post.translated_content}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                activeTab === 'translated'
                  ? 'bg-secondary text-secondary-foreground border-transparent'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Перевод
            </button>
          </div>
          <div className='text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-3 rounded-md h-40 overflow-y-auto pr-1'>
            {activeTab === 'original'
              ? (post.content || 'Нет текста')
              : (post.translated_content || 'Нет перевода')}
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-1 sm:gap-2'>
          <Badge
            variant='secondary'
            className='text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1 whitespace-nowrap'
          >
            <Eye className='h-3.5 w-3.5' />
            {post.original_views || 0}
          </Badge>
          <ReactionsSummary
            reactions={post.original_reactions}
            fallbackLikes={post.original_likes || 0}
          />
          <Badge
            variant='secondary'
            className='text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1 whitespace-nowrap'
          >
            <MessageSquare className='h-3.5 w-3.5' />
            {post.original_comments || 0}
          </Badge>
        </div>
        <div className='flex gap-2'>
          {!post.translated_content && post.content && (
            <Button
              onClick={handleTranslateClick}
              size='icon'
              variant='outline'
              className='h-9 w-9'
              aria-label='Перевести на английский'
              title='Перевести на английский'
            >
              <Languages className='h-4 w-4' />
            </Button>
          )}
          <Button
            onClick={handleDeleteClick}
            size='icon'
            variant='destructive'
            className='h-9 w-9'
            aria-label='Удалить пост'
            title='Удалить пост'
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type ReactionsSummaryProps = {
  reactions?: Record<string, number> | null;
  fallbackLikes: number;
};

function ReactionsSummary({ reactions, fallbackLikes }: ReactionsSummaryProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const hasBreakdown = !!reactions && Object.keys(reactions).length > 0;
  const total = hasBreakdown
    ? Object.values(reactions as Record<string, number>).reduce((acc, n) => acc + (n || 0), 0)
    : fallbackLikes || 0;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (panelRef.current && panelRef.current.contains(t)) return;
      if (triggerRef.current && triggerRef.current.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className='relative inline-block'>
      <div
        ref={triggerRef}
        role={hasBreakdown ? 'button' : undefined}
        tabIndex={hasBreakdown ? 0 : -1}
        onClick={() => hasBreakdown && setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (!hasBreakdown) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className={`text-xs px-2 py-1 rounded-md font-medium inline-flex items-center gap-1 whitespace-nowrap border bg-secondary text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-${
          hasBreakdown ? 'pointer' : 'default'
        } select-none ${hasBreakdown ? 'hover:bg-secondary/80 hover:shadow-sm' : ''}`}
        aria-expanded={open}
        aria-label='Показать реакции'
        title={hasBreakdown ? 'Показать все реакции' : undefined}
      >
        <Smile className='h-3.5 w-3.5' />
        {total}
        {hasBreakdown && (
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </div>
      {open && hasBreakdown && (
        <div
          ref={panelRef}
          className='absolute z-50 bottom-full left-0 mb-2 w-60 max-h-72 overflow-auto rounded-md border bg-background p-2 shadow-md'
        >
          <p className='text-xs text-muted-foreground px-1 pb-1'>Реакции</p>
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-1'>
            {Object.entries(reactions as Record<string, number>)
              .sort((a, b) => (b[1] || 0) - (a[1] || 0))
              .map(([emoji, count]) => {
                const isCustom =
                  emoji.startsWith('custom:') || emoji === 'unknown' || /[a-z]/i.test(emoji);
                return (
                  <Badge
                    key={emoji}
                    variant='secondary'
                    className='text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1 whitespace-nowrap'
                  >
                    {isCustom ? (
                      <Sparkles className='h-3.5 w-3.5' />
                    ) : (
                      <span className='text-base leading-none'>{emoji}</span>
                    )}
                    {count || 0}
                  </Badge>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

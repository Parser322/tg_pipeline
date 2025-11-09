import React from 'react';
import Image from 'next/image';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { Post, MediaItem } from '@/types/api';
import { Eye, Star, Languages, Trash2 } from 'lucide-react';

type PostCardProps = {
  post: Post;
  onTranslate: (postId: string, targetLang: string) => void;
  onDelete: (postId: string) => void;
};

const PostCard = ({ post, onTranslate, onDelete }: PostCardProps) => {
  return (
    <Card className='hover:shadow-md transition-shadow rounded-lg'>
      <CardContent className='p-4 space-y-3'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-semibold truncate'>{post.source_channel}</p>
            <p className='text-xs text-muted-foreground mt-0.5'>ID: {post.original_message_id}</p>
          </div>
          <div className='flex gap-2 items-center shrink-0'>
            <Badge variant='secondary' className='text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1'>
              <Eye className='h-3.5 w-3.5' />
              {post.original_views || 0}
            </Badge>
            {post.is_top_post && (
              <Badge variant='secondary' className='text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1'>
                <Star className='h-3.5 w-3.5 text-yellow-500' />
              </Badge>
            )}
          </div>
        </div>
        {post.media && post.media.length > 0 && (
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            {post.media.map((m: MediaItem) => {
              if (m.media_type === 'video') {
                return (
                  <div key={m.id} className='rounded-md overflow-hidden border bg-black'>
                    <video
                      src={m.url}
                      controls
                      preload='metadata'
                      className='w-full h-auto max-h-[360px]'
                    />
                  </div>
                );
              }
              // image или gif
              return (
                <div key={m.id} className='rounded-md overflow-hidden border'>
                  <Image
                    src={m.url}
                    alt=''
                    width={m.width || 800}
                    height={m.height || 600}
                    className='w-full h-auto max-h-[360px] object-contain bg-muted'
                    loading='lazy'
                    sizes='(max-width: 640px) 100vw, 50vw'
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className='space-y-2'>
          <p className='text-sm font-medium'>Оригинал</p>
          <p className='text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-3 rounded-md line-clamp-3'>
            {post.content || 'Нет текста'}
          </p>
        </div>
        {post.translated_content && (
          <div className='space-y-2'>
            <p className='text-sm font-medium'>Перевод</p>
            <p className='text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-3 rounded-md line-clamp-3'>
              {post.translated_content}
            </p>
          </div>
        )}
        <div className='flex gap-2'>
          {!post.translated_content && post.content && (
            <Button
              onClick={() => onTranslate(post.id, 'EN')}
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
            onClick={() => {
              const confirmed = window.confirm('Вы уверены, что хотите удалить этот пост?');
              if (confirmed) {
                onDelete(post.id);
              }
            }}
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
};

export default PostCard;




'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePosts } from '@/hooks/usePosts';
import { usePipeline } from '@/hooks/usePipeline';
import PostCard from './PostCard';
import { Button } from './ui/button';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PostsList() {
  const {
    posts,
    isLoading,
    errorMessage,
    successMessage,
    fetchPosts,
    handleTranslatePost,
    handleDeletePost,
    handleDeleteAllPosts,
  } = usePosts();
  const { status } = usePipeline();
  const prevFinishedRef = useRef<boolean>(false);

  useEffect(() => {
    if (status.finished && !prevFinishedRef.current) {
      void fetchPosts();
    }
    prevFinishedRef.current = status.finished;
  }, [status.finished, fetchPosts]);

  useEffect(() => {
    if (errorMessage) {
      toast.error('Ошибка', { description: errorMessage, duration: 4000 });
    }
  }, [errorMessage]);

  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage, { duration: 2500 });
    }
  }, [successMessage]);

  const handleDeleteAllClick = useCallback(() => {
    if (posts.length === 0) return;
    const confirmed = window.confirm(
      `Вы уверены, что хотите удалить все ${posts.length} постов? Это действие нельзя отменить.`
    );
    if (confirmed) {
      void handleDeleteAllPosts();
    }
  }, [posts.length, handleDeleteAllPosts]);

  if (isLoading) {
    return <p className='text-sm text-muted-foreground'>Загрузка постов...</p>;
  }

  return (
    <div>
      <div className='mb-4 flex items-center justify-between'>
        <h1 className='text-xl md:text-2xl font-bold'>Сохранённые посты</h1>
        {posts.length > 0 && (
          <Button
            onClick={handleDeleteAllClick}
            variant='destructive'
            size='icon'
            className='h-9 w-9'
            aria-label='Очистить все'
            title='Очистить все'
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        )}
      </div>
      {posts.length === 0 ? (
        <p className='text-sm text-muted-foreground'>Постов пока нет</p>
      ) : (
        <div className='columns-1 sm:columns-2 lg:columns-3 3xl:columns-4 gap-x-4'>
          {posts.map((post) => (
            <div key={post.id} className='mb-4 break-inside-avoid'>
              <PostCard post={post} onTranslate={handleTranslatePost} onDelete={handleDeletePost} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

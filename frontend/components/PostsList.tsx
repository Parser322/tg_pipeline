'use client';

import React, { useEffect, useRef } from 'react';
import { usePosts } from '@/hooks/usePosts';
import { usePipelineContext } from '@/contexts/PipelineContext';
import PostCard from './PostCard';
import { Button } from './ui/button';
import { Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

const PostsList = () => {
  const {
    posts,
    isLoading,
    error,
    message,
    fetchPosts,
    handleTranslatePost,
    handleDeletePost,
    handleDeleteAllPosts,
  } = usePosts();
  const { status } = usePipelineContext();
  const prevFinishedRef = useRef<boolean>(false);

  useEffect(() => {
    if (status.finished && !prevFinishedRef.current) {
      fetchPosts();
    }
    prevFinishedRef.current = status.finished;
  }, [status.finished, fetchPosts]);

  if (isLoading) {
    return <p className='text-sm text-muted-foreground'>Загрузка постов...</p>;
  }

  if (error) {
    return <p className='text-sm text-red-600 font-medium'>Ошибка: {error}</p>;
  }

  const handleDeleteAllClick = () => {
    if (posts.length === 0) return;
    const confirmed = window.confirm(
      `Вы уверены, что хотите удалить все ${posts.length} постов? Это действие нельзя отменить.`
    );
    if (confirmed) {
      handleDeleteAllPosts();
    }
  };

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
      {message && (
        <Alert className='mb-3 border-green-200 bg-green-50'>
          <AlertDescription className='text-green-700'>{message}</AlertDescription>
        </Alert>
      )}
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
};

export default PostsList;

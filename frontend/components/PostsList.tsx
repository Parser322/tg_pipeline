'use client';

import React, { useEffect, useRef } from 'react';
import { usePosts } from '@/hooks/usePosts';
import { usePipelineContext } from '@/contexts/PipelineContext';
import PostCard from './PostCard';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
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
    <Card className='shadow-sm rounded-lg'>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle className='text-lg font-bold'>Сохранённые посты</CardTitle>
        {posts.length > 0 && (
          <Button onClick={handleDeleteAllClick} variant='destructive' size='sm'>
            Очистить все
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {message && (
          <Alert className='mb-3 border-green-200 bg-green-50'>
            <AlertDescription className='text-green-700'>{message}</AlertDescription>
          </Alert>
        )}
        {posts.length === 0 ? (
          <p className='text-sm text-muted-foreground'>Постов пока нет</p>
        ) : (
          <div className='space-y-3'>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onTranslate={handleTranslatePost}
                onDelete={handleDeletePost}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PostsList;




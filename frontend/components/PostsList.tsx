'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { usePosts } from '@/hooks/usePosts';
import { usePostsSort } from '@/hooks/usePostsSort';
import { usePipeline } from '@/hooks/usePipeline';
import PostCard from './PostCard';
import PostsSortSelector from './PostsSortSelector';
import { toast } from 'sonner';

export default function PostsList() {
  const { sortBy, setSortBy } = usePostsSort();
  const {
    posts,
    isLoading,
    errorMessage,
    successMessage,
    fetchPosts,
    handleTranslatePost,
    handleDeletePost,
  } = usePosts(sortBy);
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

  if (isLoading) {
    return <p className='text-sm text-muted-foreground'>Загрузка постов...</p>;
  }

  return (
    <div>
      <div className='mb-4 flex items-center justify-end gap-3'>
        <PostsSortSelector sortBy={sortBy} onSortChange={setSortBy} />
      </div>
      {posts.length === 0 ? (
        <p className='text-sm text-muted-foreground'>Постов пока нет</p>
      ) : (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 gap-4'>
          {posts.map((post) => (
            <div key={post.id}>
              <PostCard post={post} onTranslate={handleTranslatePost} onDelete={handleDeletePost} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

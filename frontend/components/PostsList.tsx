'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { usePosts } from '@/hooks/usePosts';
import { usePostsSort } from '@/hooks/usePostsSort';
import { usePipeline } from '@/hooks/usePipeline';
import PostCard from './PostCard';
import PostsSortSelector from './PostsSortSelector';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { Trash2 } from 'lucide-react';
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
    handleDeleteAllPosts,
  } = usePosts(sortBy);
  const { status } = usePipeline();
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
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

  const handleDeleteAllConfirm = useCallback(() => {
    void handleDeleteAllPosts();
    setDeleteAllDialogOpen(false);
  }, [handleDeleteAllPosts]);

  if (isLoading) {
    return <p className='text-sm text-muted-foreground'>Загрузка постов...</p>;
  }

  return (
    <div>
      <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <h1 className='text-xl md:text-2xl font-bold'>Сохранённые посты</h1>
        <div className='flex items-center justify-between gap-3'>
          <PostsSortSelector sortBy={sortBy} onSortChange={setSortBy} />
          {posts.length > 0 && (
            <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant='destructive'
                  size='icon'
                  aria-label='Очистить все'
                  title='Очистить все'
                >
                  <Trash2 className='h-4 w-4' />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить все посты?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Вы уверены, что хотите удалить все {posts.length} {posts.length === 1 ? 'пост' : posts.length < 5 ? 'поста' : 'постов'}? Это действие нельзя отменить.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAllConfirm}>Удалить все</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
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

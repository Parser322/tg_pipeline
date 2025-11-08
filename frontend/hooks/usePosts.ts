import { useState, useCallback } from 'react';
import { getPosts, translatePost, deletePost, deleteAllPosts } from '@/services/api';
import type { Post } from '@/types/api';

export const usePosts = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await getPosts();
      if (response.data.ok) {
        setPosts(response.data.posts);
      } else {
        throw new Error('Failed to fetch posts');
      }
    } catch (err: any) {
      setError((err as Error).message || 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTranslatePost = useCallback(
    async (postId: string, targetLang: string) => {
      try {
        await translatePost(postId, targetLang);
        fetchPosts();
        setMessage('Пост переведён');
        setError(null);
      } catch (err: any) {
        console.error(`Failed to translate post ${postId}:`, err);
        setError(`Ошибка перевода: ${(err as Error).message}`);
        setMessage(null);
      }
    },
    [fetchPosts]
  );

  const handleDeletePost = useCallback(
    async (postId: string) => {
      try {
        await deletePost(postId);
        fetchPosts();
        setMessage('Пост удалён');
        setError(null);
      } catch (err: any) {
        console.error(`Failed to delete post ${postId}:`, err);
        setError(`Ошибка удаления: ${(err as Error).message}`);
        setMessage(null);
      }
    },
    [fetchPosts]
  );

  const handleDeleteAllPosts = useCallback(async () => {
    try {
      const response = await deleteAllPosts();
      if (response.data.ok) {
        fetchPosts();
        setMessage(response.data.message || 'Все посты удалены');
        setError(null);
      }
    } catch (err: any) {
      console.error('Failed to delete all posts:', err);
      setError(`Ошибка очистки: ${(err as Error).message}`);
      setMessage(null);
    }
  }, [fetchPosts]);

  return {
    posts,
    isLoading,
    error,
    message,
    fetchPosts,
    handleTranslatePost,
    handleDeletePost,
    handleDeleteAllPosts,
  };
};




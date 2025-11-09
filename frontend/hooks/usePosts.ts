import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPosts, translatePost as translatePostApi, deletePost as deletePostApi, deleteAllPosts as deleteAllPostsApi } from '@/services/api';
import type { Post } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

export const usePosts = () => {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const postsQuery = useQuery({
    queryKey: queryKeys.posts,
    queryFn: async () => {
      const response = await getPosts();
      if (response.data.ok) {
        return response.data.posts as Post[];
      }
      throw new Error('Failed to fetch posts');
    },
    staleTime: 15_000,
  });

  const translateMutation = useMutation({
    mutationFn: ({ postId, targetLang }: { postId: string; targetLang: string }) =>
      translatePostApi(postId, targetLang),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.posts });
      setMessage('Пост переведён');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(`Ошибка перевода: ${(err as Error).message}`);
      setMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => deletePostApi(postId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.posts });
      setMessage('Пост удалён');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(`Ошибка удаления: ${(err as Error).message}`);
      setMessage(null);
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => deleteAllPostsApi(),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.posts });
      setMessage(response.data.message || 'Все посты удалены');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(`Ошибка очистки: ${(err as Error).message}`);
      setMessage(null);
    },
  });

  const fetchPosts = useCallback(async () => {
    await postsQuery.refetch();
  }, [postsQuery]);

  const handleTranslatePost = useCallback(
    async (postId: string, targetLang: string) => {
      await translateMutation.mutateAsync({ postId, targetLang });
    },
    [translateMutation]
  );

  const handleDeletePost = useCallback(
    async (postId: string) => {
      await deleteMutation.mutateAsync(postId);
    },
    [deleteMutation]
  );

  const handleDeleteAllPosts = useCallback(async () => {
    await deleteAllMutation.mutateAsync();
  }, [deleteAllMutation]);

  return {
    posts: (postsQuery.data as Post[] | undefined) ?? [],
    isLoading: postsQuery.isLoading,
    error: (actionError ?? ((postsQuery.error as Error | null)?.message ?? null)) as string | null,
    message,
    fetchPosts,
    handleTranslatePost,
    handleDeletePost,
    handleDeleteAllPosts,
  };
};

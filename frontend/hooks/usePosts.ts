import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPosts, translatePost as translatePostApi, deletePost as deletePostApi, deleteAllPosts as deleteAllPostsApi } from '@/services/api';
import type { Post, OkResponse } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/lib/errorUtils';

type TranslatePostParams = { postId: string; targetLang: string };

export const usePosts = () => {
  const queryClient = useQueryClient();

  const postsQuery = useQuery<Post[], Error>({
    queryKey: queryKeys.posts,
    queryFn: async ({ signal }) => {
      const response = await getPosts(signal);
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }
      return response.posts;
    },
    select: (data) => {
      return [...data].sort((a, b) => {
        const idA = typeof a.id === 'string' ? parseInt(a.id, 10) : a.id;
        const idB = typeof b.id === 'string' ? parseInt(b.id, 10) : b.id;
        return idB - idA;
      });
    },
    staleTime: 15_000,
  });

  const translateMutation = useMutation<OkResponse, Error, TranslatePostParams>({
    mutationFn: ({ postId, targetLang }) => translatePostApi(postId, targetLang),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.posts });
    },
  });

  const deleteMutation = useMutation<OkResponse, Error, string>({
    mutationFn: (postId) => deletePostApi(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.posts });
      const previousPosts = queryClient.getQueryData<Post[]>(queryKeys.posts);
      
      queryClient.setQueryData<Post[]>(queryKeys.posts, (old) =>
        old?.filter((post) => post.id !== postId) ?? []
      );
      
      return { previousPosts };
    },
    onError: (err, postId, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(queryKeys.posts, context.previousPosts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts });
    },
  });

  const deleteAllMutation = useMutation<OkResponse, Error, void>({
    mutationFn: () => deleteAllPostsApi(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.posts });
      const previousPosts = queryClient.getQueryData<Post[]>(queryKeys.posts);
      
      queryClient.setQueryData<Post[]>(queryKeys.posts, []);
      
      return { previousPosts };
    },
    onError: (err, _, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(queryKeys.posts, context.previousPosts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts });
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
    posts: postsQuery.data ?? [],
    isLoading: postsQuery.isLoading,
    isFetching: postsQuery.isFetching,
    error: postsQuery.error || deleteMutation.error || deleteAllMutation.error || translateMutation.error,
    errorMessage: postsQuery.error 
      ? getErrorMessage(postsQuery.error) 
      : deleteMutation.error
      ? `Ошибка удаления: ${getErrorMessage(deleteMutation.error)}`
      : deleteAllMutation.error
      ? `Ошибка очистки: ${getErrorMessage(deleteAllMutation.error)}`
      : translateMutation.error
      ? `Ошибка перевода: ${getErrorMessage(translateMutation.error)}`
      : null,
    isDeleting: deleteMutation.isPending,
    isTranslating: translateMutation.isPending,
    isSuccess: deleteMutation.isSuccess || deleteAllMutation.isSuccess || translateMutation.isSuccess,
    successMessage: deleteMutation.isSuccess
      ? 'Пост удалён'
      : deleteAllMutation.isSuccess
      ? deleteAllMutation.data?.message || 'Все посты удалены'
      : translateMutation.isSuccess
      ? 'Пост переведён'
      : null,
    fetchPosts,
    handleTranslatePost,
    handleDeletePost,
    handleDeleteAllPosts,
  };
};

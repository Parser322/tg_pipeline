import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPosts, translatePost as translatePostApi, deletePost as deletePostApi, deleteAllPosts as deleteAllPostsApi } from '@/services/api';
import type { Post, OkResponse, SortBy } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/lib/errorUtils';
import { useUser } from './useUser';

type TranslatePostParams = { postId: string; targetLang: string };

export const usePosts = (sortBy: SortBy = 'saved_at') => {
  const queryClient = useQueryClient();
  const { userId } = useUser();

  const postsQuery = useQuery<Post[], Error>({
    queryKey: [...queryKeys.posts, sortBy, userId],
    queryFn: async ({ signal }) => {
      const response = await getPosts(signal, sortBy, userId);
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }
      return response.posts;
    },
    staleTime: 15_000,
    enabled: !!userId, // Запрашиваем только если пользователь авторизован
  });

  const translateMutation = useMutation<OkResponse, Error, TranslatePostParams>({
    mutationFn: ({ postId, targetLang }) => translatePostApi(postId, targetLang),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.posts, exact: false });
    },
  });

  const deleteMutation = useMutation<OkResponse, Error, string, { previousPosts?: Post[]; currentQueryKey: string[] }>({
    mutationFn: (postId) => deletePostApi(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.posts, exact: false });
      const currentQueryKey = [...queryKeys.posts, sortBy, userId].filter((item): item is string => item !== null);
      const previousPosts = queryClient.getQueryData<Post[]>(currentQueryKey);
      
      queryClient.setQueryData<Post[]>(currentQueryKey, (old) =>
        old?.filter((post) => post.id !== postId) ?? []
      );
      
      return { previousPosts, currentQueryKey };
    },
    onError: (err, postId, context) => {
      if (context?.previousPosts && context?.currentQueryKey) {
        queryClient.setQueryData(context.currentQueryKey, context.previousPosts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts, exact: false });
    },
  });

  const deleteAllMutation = useMutation<OkResponse, Error, void, { previousPosts?: Post[]; currentQueryKey: string[] }>({
    mutationFn: () => deleteAllPostsApi(userId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.posts, exact: false });
      const currentQueryKey = [...queryKeys.posts, sortBy, userId].filter((item): item is string => item !== null);
      const previousPosts = queryClient.getQueryData<Post[]>(currentQueryKey);
      
      queryClient.setQueryData<Post[]>(currentQueryKey, []);
      
      return { previousPosts, currentQueryKey };
    },
    onError: (err, _, context) => {
      if (context?.previousPosts && context?.currentQueryKey) {
        queryClient.setQueryData(context.currentQueryKey, context.previousPosts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts, exact: false });
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

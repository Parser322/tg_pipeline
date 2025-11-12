import { apiClient } from './apiClient';
import type {
  PipelineStatus,
  OkResponse,
  GetPostsResponse,
  CheckChannelResponse,
  CurrentChannelResponse,
  SortBy,
} from '@/types/api';

class PipelineAPI {
  run(
    limit = 100,
    period_hours: number | null = null,
    channel_url: string | null = null,
    is_top_posts = false,
    use_user_credentials = false
  ): Promise<OkResponse> {
    return apiClient.post('/run', {
      limit,
      period_hours,
      channel_url,
      is_top_posts,
      use_user_credentials,
    });
  }

  stop(): Promise<OkResponse> {
    return apiClient.post('/stop');
  }

  status(signal?: AbortSignal): Promise<PipelineStatus> {
    return apiClient.get('/status', signal);
  }
}

export const pipelineAPI = new PipelineAPI();

export const translateText = (
  text: string,
  target_lang = 'EN',
  prompt: string | null = null
): Promise<OkResponse> => {
  return apiClient.post('/translate', { text, target_lang, prompt });
};

export const getPosts = (
  signal?: AbortSignal,
  sortBy: SortBy = 'original_date'
): Promise<GetPostsResponse> => {
  const params = new URLSearchParams({ sort_by: sortBy });
  return apiClient.get(`/posts?${params.toString()}`, signal);
};

export const translatePost = (postId: string, target_lang = 'EN'): Promise<OkResponse> =>
  apiClient.post(`/posts/${postId}/translate`, { target_lang });

export const deletePost = (postId: string): Promise<OkResponse> =>
  apiClient.delete(`/posts/${postId}`);

export const deleteAllPosts = (): Promise<OkResponse> => apiClient.delete('/posts');

export const saveChannel = (username: string): Promise<OkResponse> =>
  apiClient.post('/channels', { username });

export const getCurrentChannel = (signal?: AbortSignal): Promise<CurrentChannelResponse> =>
  apiClient.get('/channels/current', signal);

export const checkChannel = (
  username: string,
  signal?: AbortSignal
): Promise<CheckChannelResponse> => apiClient.get(`/channels/${username}/check`, signal);

export const deleteCurrentChannel = (): Promise<OkResponse> =>
  apiClient.delete('/channels/current');

export const loadLargeMedia = (
  postId: string,
  mediaId: string
): Promise<OkResponse & { url?: string }> =>
  apiClient.post(`/posts/${postId}/media/${mediaId}/load-large`);

// User Telegram Credentials API
export const saveTelegramCredentials = (
  credentials: import('@/types/api').TelegramCredentials
): Promise<OkResponse> => apiClient.post('/user/telegram-credentials', credentials);

export const getUserTelegramCredentials = (
  signal?: AbortSignal
): Promise<import('@/types/api').UserTelegramCredentialsResponse> =>
  apiClient.get('/user/telegram-credentials', signal);

export const deleteUserTelegramCredentials = (): Promise<OkResponse> =>
  apiClient.delete('/user/telegram-credentials');

export const validateTelegramCredentials = (): Promise<
  import('@/types/api').ValidateCredentialsResponse
> => apiClient.post('/user/telegram-credentials/validate');

// 2FA Authorization API
export const sendTelegramCode = (
  credentials: import('@/types/api').SendCodeRequest
): Promise<import('@/types/api').SendCodeResponse> =>
  apiClient.post('/user/telegram-credentials/send-code', credentials);

export const verifyTelegramCode = (
  verification: import('@/types/api').VerifyCodeRequest
): Promise<import('@/types/api').VerifyCodeResponse> =>
  apiClient.post('/user/telegram-credentials/verify-code', verification);

export const verifyTelegramPassword = (
  verification: import('@/types/api').VerifyPasswordRequest
): Promise<import('@/types/api').VerifyPasswordResponse> =>
  apiClient.post('/user/telegram-credentials/verify-password', verification);

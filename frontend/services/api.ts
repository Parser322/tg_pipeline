import { apiClient } from './apiClient';
import type {
  PipelineStatus,
  OkResponse,
  GetPostsResponse,
  CheckChannelResponse,
  CurrentChannelResponse,
} from '@/types/api';

class PipelineAPI {
  run(
    limit = 100,
    period_hours: number | null = null,
    channel_url: string | null = null,
    is_top_posts = false
  ): Promise<OkResponse> {
    return apiClient.post('/run', { limit, period_hours, channel_url, is_top_posts });
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

export const getPosts = (signal?: AbortSignal): Promise<GetPostsResponse> =>
  apiClient.get('/posts', signal);

export const translatePost = (
  postId: string,
  target_lang = 'EN'
): Promise<OkResponse> =>
  apiClient.post(`/posts/${postId}/translate`, { target_lang });

export const deletePost = (postId: string): Promise<OkResponse> =>
  apiClient.delete(`/posts/${postId}`);

export const deleteAllPosts = (): Promise<OkResponse> => apiClient.delete('/posts');

export const saveChannel = (username: string): Promise<OkResponse> =>
  apiClient.post('/channels', { username });

export const getCurrentChannel = (
  signal?: AbortSignal
): Promise<CurrentChannelResponse> => apiClient.get('/channels/current', signal);

export const checkChannel = (
  username: string,
  signal?: AbortSignal
): Promise<CheckChannelResponse> => apiClient.get(`/channels/${username}/check`, signal);

export const deleteCurrentChannel = (): Promise<OkResponse> =>
  apiClient.delete('/channels/current');

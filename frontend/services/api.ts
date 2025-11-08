import { api } from './apiClient';
import type { AxiosResponse } from 'axios';
import type {
  PipelineStatus,
  OkResponse,
  GetPostsResponse,
  CheckChannelResponse,
  CurrentChannelResponse,
} from '@/types/api';

class PipelineAPI {
  run(limit: number = 100, period_hours: number | null = null, channel_url: string | null = null, is_top_posts: boolean = false): Promise<AxiosResponse<OkResponse>> {
    return api.post('/run', { limit, period_hours, channel_url, is_top_posts });
  }

  stop(): Promise<AxiosResponse<OkResponse>> {
    return api.post('/stop');
  }

  status(): Promise<AxiosResponse<PipelineStatus>> {
    return api.get('/status');
  }
}

export const pipelineAPI = new PipelineAPI();

export const translateText = (text: string, target_lang: string = 'EN', prompt: string | null = null): Promise<AxiosResponse<OkResponse>> => {
  return api.post('/translate', { text, target_lang, prompt });
};

export const getPosts = (): Promise<AxiosResponse<GetPostsResponse>> => api.get('/posts');
export const translatePost = (postId: string, target_lang: string = 'EN'): Promise<AxiosResponse<OkResponse>> =>
  api.post(`/posts/${postId}/translate`, { target_lang });
export const deletePost = (postId: string): Promise<AxiosResponse<OkResponse>> => api.delete(`/posts/${postId}`);
export const deleteAllPosts = (): Promise<AxiosResponse<OkResponse>> => api.delete('/posts');

export const saveChannel = (username: string): Promise<AxiosResponse<OkResponse>> => api.post('/channels', { username });
export const getCurrentChannel = (): Promise<AxiosResponse<CurrentChannelResponse>> => api.get('/channels/current');
export const checkChannel = (username: string): Promise<AxiosResponse<CheckChannelResponse>> => api.get(`/channels/${username}/check`);
export const deleteCurrentChannel = (): Promise<AxiosResponse<OkResponse>> => api.delete('/channels/current');




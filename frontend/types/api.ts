export type PipelineStatus = {
  processed: number;
  total: number;
  is_running: boolean;
  finished: boolean;
};

export type OkResponse = {
  ok: boolean;
  message?: string;
  error?: string;
};

export type MediaItem = {
  id: string;
  media_type: 'image' | 'gif' | 'video' | 'other';
  mime_type?: string | null;
  url: string;
  storage_path?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  order_index?: number | null;
};

export type ChannelInfo = {
  username: string;
};

export type CurrentChannelResponse = {
  channel?: ChannelInfo | null;
};

export type CheckChannelResponse = {
  is_saved: boolean;
};

export type Post = {
  id: string;
  source_channel: string;
  original_message_id: number | string;
  original_views?: number | null;
  is_top_post?: boolean;
  content?: string | null;
  translated_content?: string | null;
  has_media?: boolean;
  media_count?: number;
  media?: MediaItem[];
};

export type GetPostsResponse = {
  ok: boolean;
  posts: Post[];
};

export type TranslateResult = {
  translated_text: string;
};

export type ImageTranslateResult = {
  imageBase64: string;
};



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
  file_size_bytes?: number | null;
  is_oversized?: boolean;
  is_loaded?: boolean;
  telegram_message_id?: number | null;
  telegram_channel?: string | null;
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
  channel_title?: string | null;
  channel_username?: string | null;
  original_message_id: number | string;
  original_date?: string | null;
  saved_at?: string | null;
  original_views?: number | null;
  original_likes?: number | null;
  original_comments?: number | null;
  original_reactions?: Record<string, number> | null;
  is_top_post?: boolean;
  content?: string | null;
  translated_content?: string | null;
  has_media?: boolean;
  media_count?: number;
  media?: MediaItem[];
};

export type SortBy = 'original_date' | 'saved_at';

export type GetPostsResponse = {
  ok: boolean;
  posts: Post[];
};

// User Telegram Credentials types
export type TelegramCredentials = {
  telegram_api_id: number;
  telegram_api_hash: string;
  telegram_string_session: string;
  phone_number?: string | null;
  user_identifier?: string | null;
};

export type UserTelegramCredentialsResponse = {
  ok: boolean;
  has_credentials: boolean;
  telegram_api_id?: number;
  phone_number?: string | null;
  created_at?: string | null;
};

export type ValidateCredentialsResponse = {
  ok: boolean;
  valid: boolean;
  message: string;
  username?: string | null;
  phone?: string | null;
};

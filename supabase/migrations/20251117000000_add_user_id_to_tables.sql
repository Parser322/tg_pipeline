-- Migration: Add user_id to tables for multi-user support
-- This migration adds user_id column to parsed_posts, pipeline_state, and saved_channel
-- to make all data user-specific instead of shared

-- 1. Add user_id to parsed_posts table
ALTER TABLE public.parsed_posts
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster queries by user_id
CREATE INDEX IF NOT EXISTS idx_parsed_posts_user_id ON public.parsed_posts(user_id);

-- 2. Modify pipeline_state table structure
-- Drop the old state row
DELETE FROM public.pipeline_state WHERE id = 'progress_tracker';

-- Add user_id column
ALTER TABLE public.pipeline_state
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Change primary key to be composite (user_id + id) for user-specific state
ALTER TABLE public.pipeline_state
  DROP CONSTRAINT IF EXISTS pipeline_state_pkey;

ALTER TABLE public.pipeline_state
  ADD CONSTRAINT pipeline_state_pkey PRIMARY KEY (user_id, id);

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_pipeline_state_user_id ON public.pipeline_state(user_id);

-- 3. Add user_id to saved_channel table
ALTER TABLE public.saved_channel
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_saved_channel_user_id ON public.saved_channel(user_id);

-- Make username+user_id combination unique (user can save multiple channels, but each username once per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_channel_user_username ON public.saved_channel(user_id, username);

-- 4. Enable Row Level Security (RLS) for multi-user support
ALTER TABLE public.parsed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_channel ENABLE ROW LEVEL SECURITY;

-- RLS Policies for parsed_posts
CREATE POLICY "Users can view their own posts"
  ON public.parsed_posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own posts"
  ON public.parsed_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON public.parsed_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON public.parsed_posts FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can access all posts (for backend operations)
CREATE POLICY "Service role has full access to posts"
  ON public.parsed_posts FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for pipeline_state
CREATE POLICY "Users can view their own state"
  ON public.pipeline_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own state"
  ON public.pipeline_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own state"
  ON public.pipeline_state FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own state"
  ON public.pipeline_state FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can access all state (for backend operations)
CREATE POLICY "Service role has full access to state"
  ON public.pipeline_state FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for saved_channel
CREATE POLICY "Users can view their own channels"
  ON public.saved_channel FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own channels"
  ON public.saved_channel FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own channels"
  ON public.saved_channel FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own channels"
  ON public.saved_channel FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can access all channels (for backend operations)
CREATE POLICY "Service role has full access to channels"
  ON public.saved_channel FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Note: Existing data will have NULL user_id. 
-- If you need to migrate existing data to a specific user, run:
-- UPDATE public.parsed_posts SET user_id = 'USER_UUID' WHERE user_id IS NULL;
-- UPDATE public.saved_channel SET user_id = 'USER_UUID' WHERE user_id IS NULL;


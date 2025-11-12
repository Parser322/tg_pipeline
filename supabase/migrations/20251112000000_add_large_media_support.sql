-- Добавляем поддержку больших медиафайлов (>200MB)

-- Добавляем колонки для информации о размере и статусе загрузки
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS is_oversized BOOLEAN DEFAULT FALSE;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS is_loaded BOOLEAN DEFAULT TRUE;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS telegram_message_id INTEGER;
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS telegram_channel TEXT;

-- Комментарии для понимания
COMMENT ON COLUMN post_media.file_size_bytes IS 'Размер файла в байтах';
COMMENT ON COLUMN post_media.is_oversized IS 'Флаг: файл больше 200MB';
COMMENT ON COLUMN post_media.is_loaded IS 'Флаг: файл загружен в Storage (false для заглушек)';
COMMENT ON COLUMN post_media.telegram_message_id IS 'ID сообщения в Telegram для загрузки по требованию';
COMMENT ON COLUMN post_media.telegram_channel IS 'Канал Telegram для загрузки по требованию';


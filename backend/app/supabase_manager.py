from __future__ import annotations

import logging
import mimetypes
import os
import pathlib
import re
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

logger = logging.getLogger(__name__)

STATE_TABLE = "pipeline_state"
POSTS_TABLE = "parsed_posts"
CHANNELS_TABLE = "saved_channel"
MEDIA_TABLE = "post_media"
STATE_DOCUMENT_ID = "progress_tracker"
MEDIA_BUCKET = "media"

DEFAULT_STATE: Dict[str, Any] = {
    "id": STATE_DOCUMENT_ID,
    "processed": 0,
    "total": 0,
    "is_running": False,
    "finished": False,
    "channels": {},
}

_supabase: Optional[Client] = None


def _has_error(response: Any) -> bool:
    return bool(getattr(response, "error", None))


def initialize_supabase() -> Client:
    """
    Создает (или возвращает существующий) клиент Supabase.
    Вызывает ошибку с понятным сообщением, если переменные окружения не заданы.
    """
    global _supabase
    if _supabase is not None:
        return _supabase

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

    if not url or not key:
        raise RuntimeError(
            "Переменные окружения SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY должны быть заданы."
        )

    _supabase = create_client(url, key)
    _ensure_state_row()
    _ensure_media_bucket()
    return _supabase


def _client() -> Client:
    return initialize_supabase()


def _ensure_state_row() -> None:
    """
    Гарантирует наличие строки состояния. Создает её, если таблица пуста.
    """
    try:
        response = _client().table(STATE_TABLE).select("id").eq("id", STATE_DOCUMENT_ID).limit(1).execute()
        if _has_error(response):
            raise RuntimeError(getattr(response, "error", "Unknown Supabase error"))
        rows = response.data or []
        if not rows:
            logger.info("Создаю запись состояния по умолчанию в таблице %s", STATE_TABLE)
            upsert_response = _client().table(STATE_TABLE).upsert(deepcopy(DEFAULT_STATE)).execute()
            if _has_error(upsert_response):
                raise RuntimeError(getattr(upsert_response, "error", "Unknown Supabase error"))
    except Exception as exc:
        logger.error("Не удалось проверить/создать запись состояния: %s", exc)
        raise


def _ensure_media_bucket() -> None:
    """
    Гарантирует наличие публичного хранилища для медиа.
    """
    try:
        storage = _client().storage
        # Надежнее проверить через list_buckets()
        buckets = storage.list_buckets() or []
        bucket_names = []
        for b in buckets:
            if isinstance(b, dict):
                bucket_names.append(b.get("name") or b.get("id"))
            else:
                bucket_names.append(getattr(b, "name", None) or getattr(b, "id", None))
        exists = MEDIA_BUCKET in bucket_names
        if not exists:
            # В некоторых версиях API сигнатура: create_bucket(bucket_id: str, public: bool | None)
            storage.create_bucket(MEDIA_BUCKET, public=True)
            logger.info("Создан Storage bucket '%s' (public=True)", MEDIA_BUCKET)
    except Exception as exc:
        # Если не удалось создать (например, уже существует или нет прав) — логируем и продолжаем.
        logger.warning("Не удалось гарантировать bucket '%s': %s", MEDIA_BUCKET, exc)


def _serialize_datetime(value: Any) -> Any:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        else:
            value = value.astimezone(timezone.utc)
        return value.isoformat()
    return value


def get_state_document() -> Dict[str, Any]:
    try:
        response = _client().table(STATE_TABLE).select("*").eq("id", STATE_DOCUMENT_ID).limit(1).execute()
        rows = response.data or []
        return rows[0] if rows else {}
    except Exception as exc:
        logger.error("Ошибка получения состояния из Supabase: %s", exc)
        return {}


def update_state(updates: Dict[str, Any]) -> None:
    if not updates:
        return
    payload = deepcopy(updates)
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        response = _client().table(STATE_TABLE).update(payload).eq("id", STATE_DOCUMENT_ID).execute()
        if _has_error(response):
            logger.error("Ошибка обновления состояния в Supabase: %s", getattr(response, "error", None))
    except Exception as exc:
        logger.error("Ошибка обновления состояния в Supabase: %s", exc)


def set_state(state: Dict[str, Any]) -> None:
    payload = deepcopy(DEFAULT_STATE)
    payload.update(state or {})
    payload["id"] = STATE_DOCUMENT_ID
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        response = _client().table(STATE_TABLE).upsert(payload).execute()
        if _has_error(response):
            logger.error("Ошибка сохранения состояния в Supabase: %s", getattr(response, "error", None))
    except Exception as exc:
        logger.error("Ошибка сохранения состояния в Supabase: %s", exc)


def save_post(post_data: Dict[str, Any]) -> Optional[str]:
    if not isinstance(post_data, dict):
        logger.error("post_data должен быть словарем, получено: %s", type(post_data))
        return None

    payload = deepcopy(post_data)
    payload["original_date"] = _serialize_datetime(payload.get("original_date"))
    payload["saved_at"] = datetime.now(timezone.utc).isoformat()
    original_ids = payload.get("original_ids")
    if isinstance(original_ids, list):
        pass
    elif original_ids is None:
        payload["original_ids"] = []
    else:
        payload["original_ids"] = [original_ids]

    try:
        response = _client().table(POSTS_TABLE).insert(payload).execute()
        if _has_error(response):
            raise RuntimeError(getattr(response, "error", "Unknown Supabase error"))
        rows = response.data or []
        inserted = rows[0] if rows else None
        original_id = payload.get("original_message_id", "N/A")
        logger.info(
            "Пост (original_id=%s) сохранен в Supabase таблицу '%s'.",
            original_id,
            POSTS_TABLE,
        )
        return inserted.get("id") if isinstance(inserted, dict) else None
    except Exception as exc:
        logger.error("Ошибка сохранения поста в Supabase: %s", exc)
        return None


def _slugify_path_part(value: str) -> str:
    value = value.strip().lower()
    # Разрешаем латиницу/цифры/дефис/подчёркивание/точку
    value = re.sub(r"[^a-z0-9._-]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "unknown"


def _guess_mime_type(path: str) -> Tuple[str, str]:
    mime, _ = mimetypes.guess_type(path)
    if not mime:
        # Фолбэк
        ext = pathlib.Path(path).suffix.lower().lstrip(".")
        if ext in {"jpg", "jpeg", "png", "webp", "bmp", "tiff"}:
            mime = "image/" + ("jpeg" if ext in {"jpg", "jpeg"} else ext)
        elif ext in {"mp4", "mov", "mkv", "webm", "m4v"}:
            mime = "video/" + ext
        elif ext == "gif":
            mime = "image/gif"
        else:
            mime = "application/octet-stream"
    media_type = "other"
    if mime.startswith("image/"):
        media_type = "gif" if mime == "image/gif" else "image"
    elif mime.startswith("video/"):
        media_type = "video"
    return mime, media_type


def create_oversized_media_placeholders(oversized_items: List[Dict[str, Any]], channel: str, start_order_index: int = 0) -> List[Dict[str, Any]]:
    """
    Создает заглушки для больших файлов (>200MB) без загрузки.
    
    Args:
        oversized_items: Список словарей с информацией о больших файлах
        channel: Канал Telegram
        start_order_index: Начальный индекс для order_index
        
    Returns:
        Список метаданных для сохранения в БД
    """
    results: List[Dict[str, Any]] = []
    
    for idx, item in enumerate(oversized_items):
        file_size = item.get('size', 0)
        message_id = item.get('message_id')
        media_type = item.get('media_type', 'video')
        
        logger.info(f"Creating placeholder for oversized {media_type} ({file_size / 1024 / 1024:.2f} MB) from message {message_id}")
        
        # URL для заглушки - будет обработан на фронтенде
        placeholder_url = f"oversized://{channel}/{message_id}"
        
        results.append({
            "media_type": media_type,
            "mime_type": f"{media_type}/placeholder",
            "url": placeholder_url,
            "storage_path": None,
            "width": None,
            "height": None,
            "duration": None,
            "order_index": start_order_index + idx,
            "file_size_bytes": file_size,
            "is_oversized": True,
            "is_loaded": False,
            "telegram_message_id": message_id,
            "telegram_channel": channel,
        })
    
    return results

def upload_media_files(local_paths: List[str], channel: str, original_message_id: int | str) -> List[Dict[str, Any]]:
    """
    Загружает файлы в Storage и возвращает метаданные для сохранения в БД.
    """
    results: List[Dict[str, Any]] = []
    if not local_paths:
        logger.info("No media files to upload")
        return results
    
    logger.info(f"Starting upload of {len(local_paths)} media files for message {original_message_id}")
    
    # На всякий случай гарантируем наличие bucket перед загрузкой
    _ensure_media_bucket()
    safe_channel = _slugify_path_part(channel.lstrip("@"))
    folder = f"{safe_channel}/{original_message_id}"
    storage = _client().storage.from_(MEDIA_BUCKET)
    
    for idx, local_path in enumerate(local_paths):
        try:
            # Проверяем существование файла
            if not pathlib.Path(local_path).exists():
                logger.error(f"File does not exist: {local_path}")
                continue
            
            file_size = pathlib.Path(local_path).stat().st_size
            logger.info(f"Uploading file {idx+1}/{len(local_paths)}: {local_path} (size: {file_size} bytes)")
            
            mime, media_type = _guess_mime_type(local_path)
            logger.info(f"Detected MIME type: {mime}, media type: {media_type}")
            
            name = pathlib.Path(local_path).name
            dest_path = f"{folder}/{name}"
            
            with open(local_path, "rb") as f:
                # В storage-py параметры upload передаются как HTTP-заголовки.
                # Нельзя передавать bool, иначе httpx ругается: "Header value must be str or bytes".
                # Используем корректные заголовки: content-type и x-upsert: "true".
                import signal
                
                def timeout_handler(signum, frame):
                    raise TimeoutError("Upload to Supabase Storage exceeded timeout")
                
                # Устанавливаем таймаут 5 минут для загрузки
                old_handler = signal.signal(signal.SIGALRM, timeout_handler)
                signal.alarm(300)  # 5 минут
                
                try:
                    storage.upload(
                        file=f,
                        path=dest_path,
                        file_options={
                            "content-type": mime,
                            "x-upsert": "true",
                        },
                    )
                finally:
                    signal.alarm(0)  # Отменяем таймаут
                    signal.signal(signal.SIGALRM, old_handler)
            
            public_url = storage.get_public_url(dest_path)
            logger.info(f"Successfully uploaded to: {public_url}")
            
            results.append({
                "media_type": media_type,
                "mime_type": mime,
                "url": public_url,
                "storage_path": dest_path,
                "width": None,
                "height": None,
                "duration": None,
                "order_index": idx,
            })
        except TimeoutError as exc:
            logger.error("TIMEOUT: Загрузка файла '%s' в Storage превысила 5 минут. Пропускаем.", local_path)
        except Exception as exc:
            # Если bucket отсутствует (404), пробуем создать и повторить один раз
            msg = str(exc)
            if "Bucket not found" in msg or "404" in msg:
                try:
                    _ensure_media_bucket()
                    with open(local_path, "rb") as f:
                        import signal
                        
                        def timeout_handler(signum, frame):
                            raise TimeoutError("Upload to Supabase Storage exceeded timeout")
                        
                        old_handler = signal.signal(signal.SIGALRM, timeout_handler)
                        signal.alarm(300)  # 5 минут
                        
                        try:
                            storage.upload(
                                file=f,
                                path=dest_path,
                                file_options={
                                    "content-type": mime,
                                    "x-upsert": "true",
                                },
                            )
                        finally:
                            signal.alarm(0)
                            signal.signal(signal.SIGALRM, old_handler)
                    public_url = storage.get_public_url(dest_path)
                    results.append({
                        "media_type": media_type,
                        "mime_type": mime,
                        "url": public_url,
                        "storage_path": dest_path,
                        "width": None,
                        "height": None,
                        "duration": None,
                        "order_index": idx,
                    })
                    continue
                except TimeoutError:
                    logger.error("TIMEOUT: Повторная загрузка файла '%s' превысила 5 минут. Пропускаем.", local_path)
                except Exception as exc2:
                    logger.error("Повторная загрузка после создания bucket не удалась для '%s': %s", local_path, exc2)
            else:
                logger.error("Ошибка загрузки файла '%s' в Storage: %s", local_path, exc)
    return results


def get_media_item(media_id: str) -> Optional[Dict[str, Any]]:
    """Получает конкретный медиафайл по ID."""
    if not media_id:
        return None
    try:
        response = _client().table(MEDIA_TABLE).select("*").eq("id", media_id).limit(1).execute()
        if _has_error(response):
            raise RuntimeError(getattr(response, "error", "Unknown Supabase error"))
        rows = response.data or []
        return rows[0] if rows else None
    except Exception as exc:
        logger.error("Ошибка получения медиафайла %s из Supabase: %s", media_id, exc)
        return None

def update_media_item(media_id: str, updates: Dict[str, Any]) -> bool:
    """Обновляет конкретный медиафайл."""
    if not media_id or not updates:
        return False
    try:
        response = _client().table(MEDIA_TABLE).update(updates).eq("id", media_id).execute()
        if _has_error(response):
            raise RuntimeError(getattr(response, "error", "Unknown Supabase error"))
        return True
    except Exception as exc:
        logger.error("Ошибка обновления медиафайла %s в Supabase: %s", media_id, exc)
        return False

def save_post_media(post_id: str, media_items: List[Dict[str, Any]]) -> int:
    """
    Сохраняет список медиа для поста.
    """
    if not post_id or not media_items:
        return 0
    items = []
    for item in media_items:
        payload = deepcopy(item)
        payload["post_id"] = post_id
        items.append(payload)
    try:
        response = _client().table(MEDIA_TABLE).insert(items).execute()
        if _has_error(response):
            raise RuntimeError(getattr(response, "error", "Unknown Supabase error"))
        data = response.data or []
        return len(data) if isinstance(data, list) else len(items)
    except Exception as exc:
        logger.error("Ошибка сохранения медиа для поста %s: %s", post_id, exc)
        return 0


 

def get_all_posts(sort_by: str = "original_date") -> List[Dict[str, Any]]:
    """
    Возвращает все посты с сортировкой.
    
    Args:
        sort_by: Поле для сортировки ('original_date' или 'saved_at')
        
    Логика сортировки:
        - 'saved_at': от новых к старым (последние загруженные сверху)
        - 'original_date': от старых к новым (хронологический порядок публикации)
    """
    try:
        # Валидация параметра сортировки
        valid_sort_fields = ["original_date", "saved_at"]
        if sort_by not in valid_sort_fields:
            logger.warning("Invalid sort_by value '%s', defaulting to 'original_date'", sort_by)
            sort_by = "original_date"
        
        # Для saved_at - от новых к старым, для original_date - от старых к новым (хронологический порядок)
        desc_order = (sort_by == "saved_at")
        
        response = _client().table(POSTS_TABLE).select("*").order(sort_by, desc=desc_order).execute()
        if _has_error(response):
            raise RuntimeError(getattr(response, "error", "Unknown Supabase error"))
        return response.data or []
    except Exception as exc:
        logger.error("Ошибка получения постов из Supabase: %s", exc)
        return []


def get_all_posts_with_media(sort_by: str = "original_date") -> List[Dict[str, Any]]:
    """
    Возвращает посты и вложенные для них медиа (массив media[]).
    
    Args:
        sort_by: Поле для сортировки ('original_date' или 'saved_at')
    """
    posts = get_all_posts(sort_by=sort_by)
    if not posts:
        return []
    post_ids = [p.get("id") for p in posts if p.get("id")]
    try:
        media_resp = _client().table(MEDIA_TABLE).select("*").in_("post_id", post_ids).order("order_index", desc=False).execute()
        if _has_error(media_resp):
            raise RuntimeError(getattr(media_resp, "error", "Unknown Supabase error"))
        media_rows = media_resp.data or []
    except Exception as exc:
        logger.error("Ошибка получения медиа из Supabase: %s", exc)
        media_rows = []

    post_id_to_media: Dict[str, List[Dict[str, Any]]] = {}
    for row in media_rows:
        pid = row.get("post_id")
        if not pid:
            continue
        post_id_to_media.setdefault(pid, []).append({
            "id": row.get("id"),
            "media_type": row.get("media_type"),
            "mime_type": row.get("mime_type"),
            "url": row.get("url"),
            "storage_path": row.get("storage_path"),
            "width": row.get("width"),
            "height": row.get("height"),
            "duration": row.get("duration"),
            "order_index": row.get("order_index"),
            "file_size_bytes": row.get("file_size_bytes"),
            "is_oversized": row.get("is_oversized"),
            "is_loaded": row.get("is_loaded"),
            "telegram_message_id": row.get("telegram_message_id"),
            "telegram_channel": row.get("telegram_channel"),
        })

    for p in posts:
        pid = p.get("id")
        p["media"] = post_id_to_media.get(pid, [])
    return posts


def get_post(post_id: str) -> Optional[Dict[str, Any]]:
    if not post_id:
        return None
    try:
        response = _client().table(POSTS_TABLE).select("*").eq("id", post_id).limit(1).execute()
        if _has_error(response):
            raise RuntimeError(getattr(response, "error", "Unknown Supabase error"))
        rows = response.data or []
        return rows[0] if rows else None
    except Exception as exc:
        logger.error("Ошибка получения поста %s из Supabase: %s", post_id, exc)
        return None


def update_post(post_id: str, updates: Dict[str, Any]) -> bool:
    if not post_id or not updates:
        return False
    payload = deepcopy(updates)
    if "original_date" in payload:
        payload["original_date"] = _serialize_datetime(payload["original_date"])
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        response = _client().table(POSTS_TABLE).update(payload).eq("id", post_id).execute()
        if _has_error(response):
            raise RuntimeError(getattr(response, "error", "Unknown Supabase error"))
        return True
    except Exception as exc:
        logger.error("Ошибка обновления поста %s в Supabase: %s", post_id, exc)
        return False


def delete_post(post_id: str) -> bool:
    if not post_id:
        return False
    try:
        response = _client().table(POSTS_TABLE).delete().eq("id", post_id).execute()
        if _has_error(response):
            raise RuntimeError(getattr(response, "error", "Unknown Supabase error"))
        deleted = response.data or []
        if response.data is None:
            # Возврата данных может не быть при режиме returning=minimal
            return True
        return len(deleted) > 0
    except Exception as exc:
        logger.error("Ошибка удаления поста %s из Supabase: %s", post_id, exc)
        return False


def delete_all_posts() -> int:
    posts = get_all_posts()
    if not posts:
        return 0
    try:
        response = _client().table(POSTS_TABLE).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        if _has_error(response):
            raise RuntimeError(getattr(response, "error", "Unknown Supabase error"))
        return len(posts)
    except Exception as exc:
        logger.error("Ошибка удаления всех постов в Supabase: %s", exc)
        return 0


def save_channel(channel_username: str) -> bool:
    clean_username = (channel_username or "").lstrip("@").strip()
    if not clean_username:
        logger.warning("Имя канала пустое, сохранение пропущено.")
        return False

    try:
        delete_response = _client().table(CHANNELS_TABLE).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        if _has_error(delete_response):
            raise RuntimeError(getattr(delete_response, "error", "Unknown Supabase error"))
        payload = {
            "username": clean_username,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }
        insert_response = _client().table(CHANNELS_TABLE).insert(payload).execute()
        if _has_error(insert_response):
            raise RuntimeError(getattr(insert_response, "error", "Unknown Supabase error"))
        logger.info("Канал @%s сохранен в Supabase таблицу '%s'.", clean_username, CHANNELS_TABLE)
        return True
    except Exception as exc:
        logger.error("Ошибка сохранения канала %s в Supabase: %s", channel_username, exc)
        return False


def get_saved_channel() -> Optional[Dict[str, Any]]:
    try:
        response = (
            _client()
            .table(CHANNELS_TABLE)
            .select("*")
            .order("saved_at", desc=True)
            .limit(1)
            .execute()
        )
        if _has_error(response):
            raise RuntimeError(getattr(response, "error", "Unknown Supabase error"))
        rows = response.data or []
        return rows[0] if rows else None
    except Exception as exc:
        logger.error("Ошибка получения сохраненного канала из Supabase: %s", exc)
        return None


def is_channel_saved(channel_username: str) -> bool:
    clean_username = (channel_username or "").lstrip("@").strip()
    if not clean_username:
        return False
    channel = get_saved_channel()
    return bool(channel and channel.get("username") == clean_username)


def delete_saved_channel() -> bool:
    try:
        response = _client().table(CHANNELS_TABLE).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        if _has_error(response):
            raise RuntimeError(getattr(response, "error", "Unknown Supabase error"))
        return True
    except Exception as exc:
        logger.error("Ошибка удаления канала в Supabase: %s", exc)
        return False


from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio
import os
import re
import time
import hashlib
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

# Импортируем вашу основную функцию и управление состоянием
from app.main import main as run_pipeline_main
from app.state_manager import get_state, set_running, reset_state, set_finished
from app.supabase_manager import (
    initialize_supabase,
    get_all_posts,
    get_all_posts_with_media,
    get_post,
    update_post,
    delete_post,
    delete_all_posts,
    save_channel,
    get_saved_channel,
    is_channel_saved,
    delete_saved_channel,
)
from app.translation import translate_text
 

# Инициализацию Supabase выполняем лениво при первом обращении через _client().
# Это ускоряет старт и избегает падения, если переменные окружения временно не заданы.

app = FastAPI()

# CORS для связи фронтенда (Vite/React/Next) с API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Словарь задач по пользователям для поддержки многопользовательского режима
current_tasks: Dict[str, asyncio.Task] = {}

# ===============================
# Временное хранилище сессий для 2FA
# ===============================

# Структура: {session_key: {session_data, phone_code_hash, expires_at, api_id, api_hash, phone, attempts}}
temporary_sessions: Dict[str, Dict[str, Any]] = {}

# Rate limiting для защиты от злоупотреблений
# {user_key: {send_code_attempts: [(timestamp, count)], verify_code_attempts: []}}
rate_limit_storage: Dict[str, Dict[str, list]] = {}

SEND_CODE_RATE_LIMIT = 3  # Максимум 3 попытки
SEND_CODE_WINDOW = 300  # За 5 минут (300 секунд)
SEND_CODE_COOLDOWN = 60  # Минимум 60 секунд между отправками

VERIFY_CODE_RATE_LIMIT = 5  # Максимум 5 попыток
VERIFY_CODE_WINDOW = 300  # За 5 минут

SESSION_TTL = 600  # Временные сессии живут 10 минут

def _generate_session_key(phone: str, api_id: int) -> str:
    """Генерирует уникальный ключ для временной сессии."""
    raw = f"{phone}:{api_id}:{time.time()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]

def _cleanup_expired_sessions():
    """Удаляет истекшие временные сессии."""
    now = time.time()
    expired_keys = [k for k, v in temporary_sessions.items() if v.get("expires_at", 0) < now]
    for key in expired_keys:
        del temporary_sessions[key]

def _check_rate_limit(user_key: str, action: str, max_attempts: int, window: int) -> tuple[bool, Optional[int]]:
    """
    Проверяет rate limiting.
    
    Returns:
        (allowed: bool, retry_after: Optional[int])
    """
    now = time.time()
    
    if user_key not in rate_limit_storage:
        rate_limit_storage[user_key] = {}
    
    if action not in rate_limit_storage[user_key]:
        rate_limit_storage[user_key][action] = []
    
    attempts = rate_limit_storage[user_key][action]
    
    # Удаляем старые попытки вне окна
    attempts[:] = [t for t in attempts if now - t < window]
    
    if len(attempts) >= max_attempts:
        # Вычисляем время до разблокировки
        oldest = min(attempts)
        retry_after = int(oldest + window - now)
        return False, retry_after
    
    return True, None

def _record_rate_limit_attempt(user_key: str, action: str):
    """Записывает попытку для rate limiting."""
    now = time.time()
    
    if user_key not in rate_limit_storage:
        rate_limit_storage[user_key] = {}
    
    if action not in rate_limit_storage[user_key]:
        rate_limit_storage[user_key][action] = []
    
    rate_limit_storage[user_key][action].append(now)

def _normalize_channel_identifier(value: str | None) -> str | None:
    """
    Приводит ввод канала к безопасному виду для Telethon:
    - t.me/<name> / https://t.me/<name> → <name>
    - @name → name
    - иначе возвращает как есть
    """
    if not value:
        return None
    s = (value or "").strip()
    if not s:
        return None
    m = re.match(r"^(?:https?://)?t\.me/(?:c/)?([^/?#]+)", s, flags=re.IGNORECASE)
    if m:
        return m.group(1)
    if s.startswith("@"):
        return s.lstrip("@")
    return s

def _telegram_env_check() -> tuple[bool, str | None]:
    """
    Проверяет наличие ключей Telegram и одной из сессий:
    - TELEGRAM_STRING_SESSION или TELEGRAM_SESSION_B64
    - либо файл session.session рядом с backend/
    """
    api_id = os.getenv("TELEGRAM_API_ID")
    api_hash = os.getenv("TELEGRAM_API_HASH")
    if not api_id or not api_hash:
        return False, "TELEGRAM_API_ID/TELEGRAM_API_HASH не заданы на бэкенде."
    has_session_env = bool(os.getenv("TELEGRAM_STRING_SESSION") or os.getenv("TELEGRAM_SESSION_B64"))
    session_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "session.session")
    has_session_file = os.path.exists(session_file)
    if not (has_session_env or has_session_file):
        return False, "Не передана Telegram-сессия (TELEGRAM_STRING_SESSION или TELEGRAM_SESSION_B64), и отсутствует файл session.session."
    return True, None

@app.get("/health")
async def health():
    """Проверка готовности сервера и окружения."""
    env_status = {
        "SUPABASE_URL": bool(os.getenv("SUPABASE_URL")),
        "SUPABASE_SERVICE_ROLE_KEY": bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")),
        "TELEGRAM_API_ID": bool(os.getenv("TELEGRAM_API_ID")),
        "TELEGRAM_API_HASH": bool(os.getenv("TELEGRAM_API_HASH")),
        "TELEGRAM_STRING_SESSION": bool(os.getenv("TELEGRAM_STRING_SESSION")),
        "OPENAI_API_KEY": bool(os.getenv("OPENAI_API_KEY")),
    }
    # Проверим связь с Supabase через получение состояния
    try:
        state = get_state()
        supabase_ok = isinstance(state, dict)
    except Exception:
        supabase_ok = False
        state = {}
    return {
        "ok": True,
        "env": env_status,
        "supabase_ok": supabase_ok,
        "state_sample": {
            "processed": state.get("processed"),
            "total": state.get("total"),
            "is_running": state.get("is_running"),
            "finished": state.get("finished"),
        },
    }

@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Отдает HTML страницу с кнопками управления и статусом."""
    return """
    <html>
        <head>
            <title>TG Pipeline Runner</title>
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f0f0f0; }
                .container { text-align: center; }
                button { font-size: 20px; padding: 10px 20px; cursor: pointer; margin: 5px; }
                #postLimit { font-size: 20px; padding: 10px; width: 100px; text-align: center; }
                #status { margin-top: 20px; font-size: 18px; color: #555; min-height: 50px; }
                progress { width: 300px; height: 25px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Telegram Pipeline</h1>
                <div>
                    <label for="postLimit">Количество постов:</label>
                    <input type="number" id="postLimit" value="100" min="1">
                </div>
                <br>
                <button onclick="runPipeline()">Запустить</button>
                <button onclick="stopPipeline()">Остановить</button>
                <div id="status">
                    <p id="status-text">Готов к запуску.</p>
                    <progress id="progress-bar" value="0" max="100"></progress>
                </div>
            </div>
            <script>
                const statusText = document.getElementById('status-text');
                const progressBar = document.getElementById('progress-bar');

                async function runPipeline() {
                    const limit = document.getElementById('postLimit').value;
                    statusText.innerText = 'Запускаем...';
                    try {
                        const response = await fetch('/run-pipeline', { 
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ limit: parseInt(limit) })
                        });
                        const data = await response.json();
                        statusText.innerText = data.message;
                    } catch (error) {
                        statusText.innerText = 'Сетевая ошибка: ' + error;
                    }
                }

                async function stopPipeline() {
                    statusText.innerText = 'Останавливаем...';
                    try {
                        const response = await fetch('/stop-pipeline', { method: 'POST' });
                        const data = await response.json();
                        statusText.innerText = data.message;
                    } catch (error) {
                        statusText.innerText = 'Сетевая ошибка: ' + error;
                    }
                }

                // Опрашиваем статус каждые 1.5 секунды
                setInterval(async () => {
                    try {
                        const response = await fetch('/status');
                        const state = await response.json();
                        if (state.is_running) {
                            progressBar.max = state.total;
                            progressBar.value = state.processed;
                            statusText.innerText = `В процессе... Обработано ${state.processed} из ${state.total}`;
                        } else if (state.finished) {
                            progressBar.max = state.total;
                            progressBar.value = state.processed;
                            statusText.innerText = `Завершено. Обработано ${state.processed} из ${state.total}.`;
                        }
                    } catch (error) {
                        // Ничего не делаем при ошибке опроса
                    }
                }, 1500);
            </script>
        </body>
    </html>
    """

@app.get("/status")
async def status_endpoint(user_identifier: str | None = None):
    """Возвращает текущее состояние прогресса для конкретного пользователя."""
    user_id = _get_user_identifier(user_identifier)
    return get_state(user_id)

async def run_pipeline_task(
    limit: int, 
    period_hours: int | None = None, 
    channel_url: str | None = None, 
    is_top_posts: bool = False,
    user_identifier: str | None = None
):
    """Обёртка для запуска задачи и управления состоянием для конкретного пользователя."""
    global current_tasks
    user_id = _get_user_identifier(user_identifier)
    set_running(user_id, True)
    try:
        print(f"Starting pipeline with limit: {limit}, channel: {channel_url or 'from config'}, top_posts: {is_top_posts}, user: {user_id}")
        await run_pipeline_main(
            limit=limit, 
            period_hours=period_hours, 
            channel_url=channel_url, 
            is_top_posts=is_top_posts,
            user_identifier=user_id
        )
        print(f"Pipeline finished successfully for user {user_id}.")
    except asyncio.CancelledError:
        print(f"Pipeline task was cancelled for user {user_id}.")
    except Exception as e:
        print(f"An error occurred in pipeline for user {user_id}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        set_running(user_id, False)
        set_finished(user_id, True)
        # Удаляем задачу пользователя из словаря
        if user_id in current_tasks:
            del current_tasks[user_id]

@app.post("/run-pipeline")
async def trigger_pipeline(request: Request):
    """Запускает основную логику в фоновом режиме для конкретного пользователя."""
    global current_tasks
    
    data = await request.json()
    limit = data.get("limit", 100)
    period_hours = data.get("period_hours")
    channel_url = _normalize_channel_identifier(data.get("channel_url"))
    is_top_posts = data.get("is_top_posts", False)
    use_user_credentials = data.get("use_user_credentials", False)
    user_identifier_param = data.get("user_identifier")

    # User credentials теперь обязательны
    user_identifier = _get_user_identifier(user_identifier_param)
    
    # Проверяем, не запущен ли уже процесс для этого пользователя
    if user_identifier in current_tasks and not current_tasks[user_identifier].done():
        return JSONResponse(
            status_code=409, 
            content={"message": "У вас уже запущен процесс парсинга. Дождитесь завершения или остановите его."}
        )
    
    # Проверяем наличие глобальных credentials
    from app.supabase_manager import validate_telegram_credentials_exist
    is_valid, error_msg = validate_telegram_credentials_exist()
    if not is_valid:
        return JSONResponse(
            status_code=400, 
            content={"ok": False, "error": error_msg}
        )

    # Сбрасываем состояние перед новым запуском
    reset_state(user_identifier)
    
    # Создаем задачу для конкретного пользователя
    task = asyncio.create_task(run_pipeline_task(
        limit=limit, 
        period_hours=period_hours,
        channel_url=channel_url,
        is_top_posts=is_top_posts,
        user_identifier=user_identifier
    ))
    current_tasks[user_identifier] = task
    
    return {"message": f"Процесс парсинга запущен. Лимит: {limit} постов."}

@app.post("/stop-pipeline")
async def stop_pipeline_endpoint(request: Request):
    """Отменяет запущенную задачу конкретного пользователя."""
    global current_tasks
    
    # Получаем user_identifier из тела запроса или query параметров
    try:
        data = await request.json()
        user_identifier_param = data.get("user_identifier")
    except:
        user_identifier_param = None
    
    user_identifier = _get_user_identifier(user_identifier_param)
    
    # Проверяем наличие активной задачи для пользователя
    if user_identifier not in current_tasks or current_tasks[user_identifier].done():
        return JSONResponse(
            status_code=404, 
            content={"message": "У вас нет активных процессов для остановки."}
        )

    # Отменяем задачу пользователя
    current_tasks[user_identifier].cancel()
    return {"message": "Команда на остановку отправлена. Процесс завершится в ближайшее время."}

# --- Совместимость с фронтендом: алиасы под ожидаемые пути ---
@app.post("/run")
async def run_alias(request: Request):
    # Делегируем в основной обработчик
    return await trigger_pipeline(request)

@app.post("/stop")
async def stop_alias(request: Request):
    # Делегируем в основной обработчик
    return await stop_pipeline_endpoint(request)

# --- Эндпоинт для перевода текста ---
class TranslationPayload(BaseModel):
    text: str
    target_lang: str = "EN"
    prompt: str | None = None

# --- Pydantic модели для 2FA авторизации Telegram ---
class SendCodePayload(BaseModel):
    telegram_api_id: int = Field(..., gt=0)
    telegram_api_hash: str = Field(..., min_length=32, max_length=32)
    phone_number: str = Field(..., pattern=r'^\+\d{10,15}$')
    user_identifier: Optional[str] = None

class VerifyCodePayload(BaseModel):
    telegram_api_id: int = Field(..., gt=0)
    telegram_api_hash: str = Field(..., min_length=32, max_length=32)
    phone_number: str = Field(..., pattern=r'^\+\d{10,15}$')
    code: str = Field(..., min_length=5, max_length=6)
    phone_code_hash: str = Field(..., min_length=1)
    session_key: str = Field(..., min_length=32, max_length=32)
    user_identifier: Optional[str] = None

class VerifyPasswordPayload(BaseModel):
    password: str = Field(..., min_length=1)
    session_key: str = Field(..., min_length=32, max_length=32)
    user_identifier: Optional[str] = None

@app.post("/translate")
async def translate_endpoint(payload: TranslationPayload):
    """Переводит текст с помощью OpenAI API."""
    try:
        translated = await translate_text(
            text=payload.text,
            target_lang=payload.target_lang,
            custom_prompt_template=payload.prompt
        )
        return {"ok": True, "translated_text": translated}
    except Exception as e:
        print(f"Translation endpoint error: {e}")
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})


# --- Эндпоинты для управления сохраненными постами ---

@app.get("/posts")
async def list_posts_endpoint(sort_by: str = "original_date", user_identifier: str | None = None):
    """
    Возвращает список всех сохраненных постов конкретного пользователя.
    
    Query params:
        sort_by: Поле для сортировки ('original_date' - по времени поста, 'saved_at' - по времени загрузки)
        user_identifier: Идентификатор пользователя (опционально, по умолчанию берется из функции)
    """
    user_id = _get_user_identifier(user_identifier)
    # Возвращаем посты с вложениями media[]
    posts = get_all_posts_with_media(user_id, sort_by=sort_by)
    return {"ok": True, "posts": posts}

class ManualTranslationPayload(BaseModel):
    target_lang: str = "EN"

@app.post("/posts/{post_id}/translate")
async def translate_post_endpoint(post_id: str, payload: ManualTranslationPayload):
    """Переводит конкретный сохраненный пост и обновляет его в Supabase."""
    post = get_post(post_id)
    if not post:
        return JSONResponse(status_code=404, content={"ok": False, "error": "Post not found"})
    
    original_text = post.get("content")
    if not original_text:
        return JSONResponse(status_code=400, content={"ok": False, "error": "Post has no text to translate"})

    try:
        translated = await translate_text(
            text=original_text,
            target_lang=payload.target_lang
        )
        
        # Обновляем документ в Supabase
        updates = {
            "translated_content": translated,
            "target_lang": payload.target_lang
        }
        update_post(post_id, updates)
        
        return {"ok": True, "message": "Post translated and updated successfully."}
    except Exception as e:
        print(f"Manual translation endpoint error: {e}")
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.post("/posts/{post_id}/media/{media_id}/load-large")
async def load_large_media_endpoint(post_id: str, media_id: str):
    """Загружает большой медиафайл по требованию."""
    try:
        from app.supabase_manager import get_media_item, update_media_item, upload_media_files
        from telethon import TelegramClient
        from telethon.sessions import StringSession
        import os
        import pathlib
        from app.main import download_and_brand, _get_telegram_credentials, OUT
        
        # Получаем информацию о медиафайле
        media_item = get_media_item(media_id)
        if not media_item:
            return JSONResponse(status_code=404, content={"ok": False, "error": "Media item not found"})
        
        if not media_item.get('is_oversized'):
            return JSONResponse(status_code=400, content={"ok": False, "error": "Media item is not oversized"})
        
        if media_item.get('is_loaded'):
            return JSONResponse(status_code=200, content={"ok": True, "message": "Media already loaded", "url": media_item.get('url')})
        
        telegram_channel = media_item.get('telegram_channel')
        telegram_message_id = media_item.get('telegram_message_id')
        
        if not telegram_channel or not telegram_message_id:
            return JSONResponse(status_code=400, content={"ok": False, "error": "Missing telegram info"})
        
        # Подключаемся к Telegram
        api_id, api_hash = _get_telegram_credentials()
        session_string = os.getenv("TELEGRAM_STRING_SESSION")
        session_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "session")
        
        client = None
        if session_string:
            client = TelegramClient(StringSession(session_string), api_id, api_hash)
        else:
            client = TelegramClient(session_path, api_id, api_hash)
        
        try:
            await client.start()
            
            # Получаем сообщение из Telegram
            entity = await client.get_entity(telegram_channel)
            message = await client.get_messages(entity, ids=telegram_message_id)
            
            if not message or not message.media:
                return JSONResponse(status_code=404, content={"ok": False, "error": "Message not found in Telegram"})
            
            # Загружаем медиа (без ограничения размера)
            print(f"Loading large media from message {telegram_message_id}...")
            raw = await client.download_media(message)
            
            if not raw:
                return JSONResponse(status_code=500, content={"ok": False, "error": "Failed to download media"})
            
            # Обрабатываем файл (брендирование)
            from app.main import brand_video, add_logo_image, CFG
            processed_path = raw
            
            # Определяем тип медиа
            low = raw.lower()
            if low.endswith((".mp4", ".mov", ".mkv", ".webm", ".m4v")):
                processed_path = brand_video(raw, CFG["logo"]["path"])
            elif low.endswith((".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff")):
                processed_path = add_logo_image(raw, CFG["logo"]["path"], CFG["logo"]["position"], CFG["logo"]["margin"])
                try:
                    os.remove(raw)
                except:
                    pass
            
            # Загружаем в Supabase Storage
            uploaded = upload_media_files([processed_path], telegram_channel, telegram_message_id)
            
            if uploaded and len(uploaded) > 0:
                uploaded_item = uploaded[0]
                # Обновляем запись в БД
                update_media_item(media_id, {
                    "url": uploaded_item.get('url'),
                    "storage_path": uploaded_item.get('storage_path'),
                    "mime_type": uploaded_item.get('mime_type'),
                    "is_loaded": True,
                })
                
                # Чистим временные файлы
                try:
                    pathlib.Path(processed_path).unlink(missing_ok=True)
                except:
                    pass
                
                return {"ok": True, "message": "Large media loaded successfully", "url": uploaded_item.get('url')}
            else:
                return JSONResponse(status_code=500, content={"ok": False, "error": "Failed to upload media to storage"})
            
        finally:
            if client.is_connected():
                await client.disconnect()
        
    except Exception as e:
        print(f"Load large media endpoint error: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.delete("/posts/{post_id}")
async def delete_post_endpoint(post_id: str):
    """Удаляет конкретный пост по ID."""
    try:
        success = delete_post(post_id)
        if success:
            return {"ok": True, "message": "Post deleted successfully."}
        else:
            return JSONResponse(status_code=404, content={"ok": False, "error": "Post not found or could not be deleted"})
    except Exception as e:
        print(f"Delete post endpoint error: {e}")
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.delete("/posts")
async def delete_all_posts_endpoint(user_identifier: str | None = None):
    """Удаляет все сохраненные посты конкретного пользователя."""
    try:
        user_id = _get_user_identifier(user_identifier)
        deleted_count = delete_all_posts(user_id)
        return {"ok": True, "message": f"Successfully deleted {deleted_count} posts."}
    except Exception as e:
        print(f"Delete all posts endpoint error: {e}")
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

# --- Эндпоинты для работы с каналами ---

class ChannelPayload(BaseModel):
    username: str

@app.post("/channels")
async def save_channel_endpoint(payload: ChannelPayload, user_identifier: str | None = None):
    """Сохраняет канал в БД для конкретного пользователя."""
    try:
        user_id = _get_user_identifier(user_identifier)
        success = save_channel(user_id, payload.username)
        if success:
            return {"ok": True, "message": "Channel saved successfully."}
        else:
            return JSONResponse(status_code=400, content={"ok": False, "error": "Failed to save channel"})
    except Exception as e:
        print(f"Save channel endpoint error: {e}")
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.get("/channels/current")
async def get_current_channel_endpoint(user_identifier: str | None = None):
    """Получает текущий сохраненный канал конкретного пользователя."""
    try:
        user_id = _get_user_identifier(user_identifier)
        channel = get_saved_channel(user_id)
        return {"ok": True, "channel": channel}
    except Exception as e:
        print(f"Get current channel endpoint error: {e}")
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.get("/channels/{username}/check")
async def check_channel_endpoint(username: str, user_identifier: str | None = None):
    """Проверяет, сохранен ли канал для конкретного пользователя."""
    try:
        user_id = _get_user_identifier(user_identifier)
        is_saved = is_channel_saved(user_id, username)
        return {"ok": True, "is_saved": is_saved}
    except Exception as e:
        print(f"Check channel endpoint error: {e}")
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.delete("/channels/current")
async def delete_current_channel_endpoint(user_identifier: str | None = None):
    """Удаляет текущий сохраненный канал конкретного пользователя."""
    try:
        user_id = _get_user_identifier(user_identifier)
        success = delete_saved_channel(user_id)
        if success:
            return {"ok": True, "message": "Channel deleted successfully."}
        else:
            return JSONResponse(status_code=404, content={"ok": False, "error": "No saved channel found"})
    except Exception as e:
        print(f"Delete current channel endpoint error: {e}")
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})


# --- Эндпоинты для работы с User Telegram Credentials ---

class TelegramCredentialsPayload(BaseModel):
    telegram_api_id: int
    telegram_api_hash: str
    telegram_string_session: str
    phone_number: str | None = None
    user_identifier: str | None = None  # Опционально: если не передан, используется дефолтный

def _get_user_identifier(payload_identifier: str | None = None) -> str:
    """
    Получает идентификатор пользователя.
    В production здесь должна быть аутентификация (JWT, session, etc).
    Пока используем простой identifier или дефолтный.
    """
    # TODO: В production получать из JWT токена или сессии
    # from fastapi import Depends
    # current_user = Depends(get_current_user)
    # return current_user.id
    
    if payload_identifier:
        return payload_identifier
    
    # Дефолтный пользователь для demo/dev режима
    return os.getenv("DEFAULT_USER_ID", "demo-user")

@app.post("/user/telegram-credentials")
async def save_global_telegram_credentials_endpoint(payload: TelegramCredentialsPayload):
    """
    Сохраняет глобальные Telegram API credentials.
    Credentials шифруются перед сохранением в БД.
    Доступно только администраторам.
    """
    try:
        from app.crypto_utils import encrypt_string
        from app.supabase_manager import save_user_telegram_credentials
        
        # Всегда сохраняем как глобальные credentials
        user_identifier = "global"
        
        # Шифруем session перед сохранением
        encrypted_session = encrypt_string(payload.telegram_string_session)
        
        success = save_user_telegram_credentials(
            user_identifier=user_identifier,
            telegram_api_id=payload.telegram_api_id,
            telegram_api_hash=payload.telegram_api_hash,
            encrypted_session=encrypted_session,
            phone_number=payload.phone_number
        )
        
        if success:
            return {"ok": True, "message": "Telegram credentials сохранены успешно"}
        else:
            return JSONResponse(
                status_code=500,
                content={"ok": False, "error": "Не удалось сохранить credentials"}
            )
    except Exception as e:
        print(f"Save telegram credentials error: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": str(e)}
        )

@app.get("/user/telegram-credentials")
async def get_global_telegram_credentials_endpoint():
    """
    Проверяет наличие глобальных Telegram credentials.
    Возвращает только факт наличия и API ID (без чувствительных данных).
    """
    try:
        from app.supabase_manager import get_global_telegram_credentials
        
        credentials = get_global_telegram_credentials()
        
        if credentials:
            return {
                "ok": True,
                "has_credentials": True,
                "telegram_api_id": credentials.get("telegram_api_id"),
                "phone_number": credentials.get("phone_number"),
                "created_at": credentials.get("created_at")
            }
        else:
            return {
                "ok": True,
                "has_credentials": False
            }
    except Exception as e:
        print(f"Get telegram credentials error: {e}")
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": str(e)}
        )

@app.delete("/user/telegram-credentials")
async def delete_global_telegram_credentials_endpoint():
    """Удаляет (деактивирует) глобальные Telegram credentials."""
    try:
        from app.supabase_manager import delete_user_telegram_credentials
        
        # Удаляем глобальные credentials
        user_id = "global"
        success = delete_user_telegram_credentials(user_id)
        
        if success:
            return {"ok": True, "message": "Credentials удалены успешно"}
        else:
            return JSONResponse(
                status_code=404,
                content={"ok": False, "error": "Credentials не найдены"}
            )
    except Exception as e:
        print(f"Delete telegram credentials error: {e}")
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": str(e)}
        )

@app.post("/user/telegram-credentials/validate")
async def validate_global_telegram_credentials_endpoint():
    """
    Проверяет валидность глобальных Telegram credentials,
    пытаясь подключиться к Telegram API.
    """
    try:
        from app.supabase_manager import get_global_telegram_credentials
        from app.crypto_utils import decrypt_string
        from telethon import TelegramClient
        from telethon.sessions import StringSession
        
        credentials = get_global_telegram_credentials()
        
        if not credentials:
            return JSONResponse(
                status_code=404,
                content={"ok": False, "error": "Credentials не найдены"}
            )
        
        # Расшифровываем session
        decrypted_session = decrypt_string(credentials["telegram_string_session"])
        
        # Пробуем подключиться
        client = TelegramClient(
            StringSession(decrypted_session),
            credentials["telegram_api_id"],
            credentials["telegram_api_hash"]
        )
        
        try:
            await client.connect()
            if await client.is_user_authorized():
                me = await client.get_me()
                await client.disconnect()
                return {
                    "ok": True,
                    "valid": True,
                    "message": f"Credentials валидны. Подключен как {me.first_name}",
                    "username": me.username,
                    "phone": me.phone
                }
            else:
                await client.disconnect()
                return {
                    "ok": True,
                    "valid": False,
                    "message": "Пользователь не авторизован в Telegram"
                }
        except Exception as conn_error:
            if client.is_connected():
                await client.disconnect()
            return {
                "ok": True,
                "valid": False,
                "message": f"Ошибка подключения: {str(conn_error)}"
            }
    except Exception as e:
        print(f"Validate telegram credentials error: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": str(e)}
        )

# ===============================
# 2FA Authorization Endpoints
# ===============================

@app.post("/user/telegram-credentials/send-code")
async def send_telegram_verification_code(payload: SendCodePayload):
    """
    Отправляет код подтверждения в Telegram.
    
    Процесс:
    1. Создает временный TelegramClient
    2. Отправляет код на указанный номер телефона
    3. Сохраняет временную сессию для последующей верификации
    4. Возвращает session_key для следующего шага
    """
    _cleanup_expired_sessions()
    
    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession
        from telethon.errors import (
            ApiIdInvalidError, 
            PhoneNumberInvalidError,
            FloodWaitError
        )
        
        # Rate limiting - проверяем отправку кода
        user_key = f"{payload.phone_number}:{payload.telegram_api_id}"
        allowed, retry_after = _check_rate_limit(
            user_key, 
            "send_code", 
            SEND_CODE_RATE_LIMIT, 
            SEND_CODE_WINDOW
        )
        
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "ok": False,
                    "error": f"Слишком много попыток. Подождите {retry_after} секунд.",
                    "retry_after": retry_after
                }
            )
        
        # Создаем временный клиент с пустой сессией
        client = TelegramClient(
            StringSession(),
            payload.telegram_api_id,
            payload.telegram_api_hash
        )
        
        try:
            await client.connect()
            
            # Отправляем код
            sent_code = await client.send_code_request(payload.phone_number)
            
            # Получаем данные сессии для сохранения
            session_string = client.session.save()
            
            # Генерируем ключ для временного хранилища
            session_key = _generate_session_key(payload.phone_number, payload.telegram_api_id)
            
            # Сохраняем временную сессию
            temporary_sessions[session_key] = {
                "session_data": session_string,
                "phone_code_hash": sent_code.phone_code_hash,
                "api_id": payload.telegram_api_id,
                "api_hash": payload.telegram_api_hash,
                "phone": payload.phone_number,
                "user_identifier": _get_user_identifier(payload.user_identifier),
                "expires_at": time.time() + SESSION_TTL,
                "verify_attempts": 0
            }
            
            # Отключаемся (но сессия сохранена)
            await client.disconnect()
            
            # Записываем попытку для rate limiting
            _record_rate_limit_attempt(user_key, "send_code")
            
            print(f"Code sent to {payload.phone_number}, session_key: {session_key}")
            
            return {
                "ok": True,
                "code_sent": True,
                "session_key": session_key,
                "phone_code_hash": sent_code.phone_code_hash,
                "expires_in": SESSION_TTL
            }
            
        except ApiIdInvalidError:
            return JSONResponse(
                status_code=400,
                content={"ok": False, "error": "Неверный API ID или API Hash"}
            )
        except PhoneNumberInvalidError:
            return JSONResponse(
                status_code=400,
                content={"ok": False, "error": "Неверный номер телефона. Используйте международный формат (+7...)"}
            )
        except FloodWaitError as e:
            return JSONResponse(
                status_code=429,
                content={
                    "ok": False,
                    "error": f"Telegram ограничил отправку кодов. Подождите {e.seconds} секунд.",
                    "retry_after": e.seconds
                }
            )
        finally:
            if client.is_connected():
                await client.disconnect()
                
    except Exception as e:
        print(f"Send verification code error: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": f"Ошибка отправки кода: {str(e)}"}
        )

@app.post("/user/telegram-credentials/verify-code")
async def verify_telegram_code(payload: VerifyCodePayload):
    """
    Подтверждает код из Telegram и создает постоянную сессию.
    
    Процесс:
    1. Восстанавливает временный TelegramClient
    2. Подтверждает код
    3. Если требуется 2FA пароль - возвращает needs_password: true
    4. Иначе сохраняет session_string в БД
    """
    _cleanup_expired_sessions()
    
    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession
        from telethon.errors import (
            PhoneCodeInvalidError,
            PhoneCodeExpiredError,
            SessionPasswordNeededError,
            FloodWaitError
        )
        from app.crypto_utils import encrypt_string
        from app.supabase_manager import save_user_telegram_credentials
        
        # Получаем временную сессию
        session_data = temporary_sessions.get(payload.session_key)
        
        if not session_data:
            return JSONResponse(
                status_code=400,
                content={"ok": False, "error": "Сессия не найдена или истекла. Запросите новый код."}
            )
        
        # Проверяем rate limiting для verify
        user_key = f"{payload.phone_number}:{payload.telegram_api_id}:verify"
        allowed, retry_after = _check_rate_limit(
            user_key,
            "verify_code",
            VERIFY_CODE_RATE_LIMIT,
            VERIFY_CODE_WINDOW
        )
        
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "ok": False,
                    "error": f"Слишком много попыток ввода кода. Подождите {retry_after} секунд.",
                    "retry_after": retry_after
                }
            )
        
        # Восстанавливаем клиент из сохраненной сессии
        client = TelegramClient(
            StringSession(session_data["session_data"]),
            session_data["api_id"],
            session_data["api_hash"]
        )
        
        try:
            await client.connect()
            
            # Пытаемся войти с кодом
            try:
                await client.sign_in(
                    payload.phone_number,
                    payload.code,
                    phone_code_hash=payload.phone_code_hash
                )
                
                # Успешная авторизация!
                final_session_string = client.session.save()
                
                # Шифруем и сохраняем в БД
                encrypted_session = encrypt_string(final_session_string)
                user_id = _get_user_identifier(payload.user_identifier)
                
                success = save_user_telegram_credentials(
                    user_identifier=user_id,
                    telegram_api_id=payload.telegram_api_id,
                    telegram_api_hash=payload.telegram_api_hash,
                    encrypted_session=encrypted_session,
                    phone_number=payload.phone_number
                )
                
                # Удаляем временную сессию
                if payload.session_key in temporary_sessions:
                    del temporary_sessions[payload.session_key]
                
                await client.disconnect()
                
                if success:
                    return {
                        "ok": True,
                        "authorized": True,
                        "message": "Авторизация успешна!"
                    }
                else:
                    return JSONResponse(
                        status_code=500,
                        content={"ok": False, "error": "Не удалось сохранить credentials в БД"}
                    )
                    
            except SessionPasswordNeededError:
                # Требуется 2FA пароль
                # Обновляем временную сессию с новыми данными
                temporary_sessions[payload.session_key]["session_data"] = client.session.save()
                temporary_sessions[payload.session_key]["expires_at"] = time.time() + SESSION_TTL
                
                await client.disconnect()
                
                return {
                    "ok": True,
                    "authorized": False,
                    "needs_password": True,
                    "message": "Требуется пароль двухфакторной аутентификации",
                    "session_key": payload.session_key
                }
                
        except PhoneCodeInvalidError:
            _record_rate_limit_attempt(user_key, "verify_code")
            return JSONResponse(
                status_code=400,
                content={"ok": False, "error": "Неверный код подтверждения"}
            )
        except PhoneCodeExpiredError:
            # Удаляем истекшую сессию
            if payload.session_key in temporary_sessions:
                del temporary_sessions[payload.session_key]
            return JSONResponse(
                status_code=400,
                content={"ok": False, "error": "Код истек. Запросите новый код."}
            )
        except FloodWaitError as e:
            return JSONResponse(
                status_code=429,
                content={
                    "ok": False,
                    "error": f"Слишком много попыток. Подождите {e.seconds} секунд.",
                    "retry_after": e.seconds
                }
            )
        finally:
            if client.is_connected():
                await client.disconnect()
                
    except Exception as e:
        print(f"Verify code error: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": f"Ошибка проверки кода: {str(e)}"}
        )

@app.post("/user/telegram-credentials/verify-password")
async def verify_telegram_password(payload: VerifyPasswordPayload):
    """
    Подтверждает 2FA пароль для аккаунтов с двухфакторной аутентификацией.
    
    Процесс:
    1. Восстанавливает клиент из временной сессии
    2. Подтверждает пароль
    3. Сохраняет session_string в БД
    """
    _cleanup_expired_sessions()
    
    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession
        from telethon.errors import PasswordHashInvalidError, FloodWaitError
        from app.crypto_utils import encrypt_string
        from app.supabase_manager import save_user_telegram_credentials
        
        # Получаем временную сессию
        session_data = temporary_sessions.get(payload.session_key)
        
        if not session_data:
            return JSONResponse(
                status_code=400,
                content={"ok": False, "error": "Сессия не найдена или истекла. Начните авторизацию заново."}
            )
        
        # Восстанавливаем клиент
        client = TelegramClient(
            StringSession(session_data["session_data"]),
            session_data["api_id"],
            session_data["api_hash"]
        )
        
        try:
            await client.connect()
            
            # Подтверждаем пароль
            try:
                await client.sign_in(password=payload.password)
                
                # Успешная авторизация!
                final_session_string = client.session.save()
                
                # Шифруем и сохраняем в БД
                encrypted_session = encrypt_string(final_session_string)
                user_id = _get_user_identifier(payload.user_identifier or session_data.get("user_identifier"))
                
                success = save_user_telegram_credentials(
                    user_identifier=user_id,
                    telegram_api_id=session_data["api_id"],
                    telegram_api_hash=session_data["api_hash"],
                    encrypted_session=encrypted_session,
                    phone_number=session_data["phone"]
                )
                
                # Удаляем временную сессию
                if payload.session_key in temporary_sessions:
                    del temporary_sessions[payload.session_key]
                
                await client.disconnect()
                
                if success:
                    return {
                        "ok": True,
                        "authorized": True,
                        "message": "Авторизация с 2FA успешна!"
                    }
                else:
                    return JSONResponse(
                        status_code=500,
                        content={"ok": False, "error": "Не удалось сохранить credentials в БД"}
                    )
                    
            except PasswordHashInvalidError:
                return JSONResponse(
                    status_code=400,
                    content={"ok": False, "error": "Неверный пароль двухфакторной аутентификации"}
                )
            except FloodWaitError as e:
                return JSONResponse(
                    status_code=429,
                    content={
                        "ok": False,
                        "error": f"Слишком много попыток. Подождите {e.seconds} секунд.",
                        "retry_after": e.seconds
                    }
                )
        finally:
            if client.is_connected():
                await client.disconnect()
                
    except Exception as e:
        print(f"Verify password error: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": f"Ошибка проверки пароля: {str(e)}"}
        )


# Диагностический эндпоинт: простая отправка текста в канал
class EchoPayload(BaseModel):
    text: str = "test from API"

@app.post("/debug/send-text")
async def debug_send_text(payload: EchoPayload):
    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession
        from dotenv import load_dotenv
        import os
        load_dotenv()
        api_id = int(os.getenv("TELEGRAM_API_ID"))
        api_hash = os.getenv("TELEGRAM_API_HASH")
        session_string = os.getenv("TELEGRAM_STRING_SESSION")
        if session_string:
            client = TelegramClient(StringSession(session_string), api_id, api_hash)
        else:
            session_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "session")
            client = TelegramClient(session_path, api_id, api_hash)
        await client.start()
        await client.send_message("me", f"[debug] {payload.text}")
        # отправка в канал назначения (если нужно)
        # from app.main import TARGET
        # await client.send_message(TARGET, f"[debug] {payload.text}")
        await client.disconnect()
        return {"ok": True, "message": "debug text sent"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

if __name__ == "__main__":
    print("Запустите сервер командой: uvicorn web:app --reload")
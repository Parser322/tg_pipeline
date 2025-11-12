from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio
import os
import re
from pydantic import BaseModel

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

# Глобальная переменная для отслеживания задачи
current_task: asyncio.Task = None

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
async def status_endpoint():
    """Возвращает текущее состояние прогресса."""
    return get_state()

async def run_pipeline_task(
    limit: int, 
    period_hours: int | None = None, 
    channel_url: str | None = None, 
    is_top_posts: bool = False,
    user_identifier: str | None = None
):
    """Обёртка для запуска задачи и управления состоянием."""
    global current_task
    set_running(True)
    try:
        print(f"Starting pipeline with limit: {limit}, channel: {channel_url or 'from config'}, top_posts: {is_top_posts}, user: {user_identifier}")
        await run_pipeline_main(
            limit=limit, 
            period_hours=period_hours, 
            channel_url=channel_url, 
            is_top_posts=is_top_posts,
            user_identifier=user_identifier
        )
        print("Pipeline finished successfully.")
    except asyncio.CancelledError:
        print("Pipeline task was cancelled.")
    except Exception as e:
        print(f"An error occurred in pipeline: {e}")
        import traceback
        traceback.print_exc()
    finally:
        set_running(False)
        set_finished(True) # Устанавливаем флаг завершения
        current_task = None

@app.post("/run-pipeline")
async def trigger_pipeline(request: Request):
    """Запускает основную логику в фоновом режиме."""
    global current_task
    if current_task and not current_task.done():
        return JSONResponse(status_code=409, content={"message": "Процесс уже запущен."})
    
    data = await request.json()
    limit = data.get("limit", 100)
    period_hours = data.get("period_hours")
    channel_url = _normalize_channel_identifier(data.get("channel_url"))
    is_top_posts = data.get("is_top_posts", False)
    use_user_credentials = data.get("use_user_credentials", False)
    user_identifier_param = data.get("user_identifier")

    # User credentials теперь обязательны
    user_identifier = _get_user_identifier(user_identifier_param)
    
    # Проверяем наличие credentials у пользователя
    from app.supabase_manager import validate_telegram_credentials_exist
    is_valid, error_msg = validate_telegram_credentials_exist(user_identifier)
    if not is_valid:
        return JSONResponse(
            status_code=400, 
            content={"ok": False, "error": error_msg}
        )

    # Сбрасываем состояние перед новым запуском
    reset_state()
    
    task = asyncio.create_task(run_pipeline_task(
        limit=limit, 
        period_hours=period_hours,
        channel_url=channel_url,
        is_top_posts=is_top_posts,
        user_identifier=user_identifier
    ))
    current_task = task
    
    return {"message": f"Процесс парсинга запущен. Лимит: {limit} постов."}

@app.post("/stop-pipeline")
async def stop_pipeline_endpoint():
    """Отменяет запущенную задачу."""
    global current_task
    if not current_task or current_task.done():
        return JSONResponse(status_code=404, content={"message": "Нет активных процессов для остановки."})

    current_task.cancel()
    return {"message": "Команда на остановку отправлена. Процесс завершится в ближайшее время."}

# --- Совместимость с фронтендом: алиасы под ожидаемые пути ---
@app.post("/run")
async def run_alias(request: Request):
    # Делегируем в основной обработчик
    return await trigger_pipeline(request)

@app.post("/stop")
async def stop_alias():
    # Делегируем в основной обработчик
    return await stop_pipeline_endpoint()

# --- Эндпоинт для перевода текста ---
class TranslationPayload(BaseModel):
    text: str
    target_lang: str = "EN"
    prompt: str | None = None

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
async def list_posts_endpoint(sort_by: str = "original_date"):
    """
    Возвращает список всех сохраненных постов.
    
    Query params:
        sort_by: Поле для сортировки ('original_date' - по времени поста, 'saved_at' - по времени загрузки)
    """
    # Возвращаем посты с вложениями media[]
    posts = get_all_posts_with_media(sort_by=sort_by)
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
async def delete_all_posts_endpoint():
    """Удаляет все сохраненные посты."""
    try:
        deleted_count = delete_all_posts()
        return {"ok": True, "message": f"Successfully deleted {deleted_count} posts."}
    except Exception as e:
        print(f"Delete all posts endpoint error: {e}")
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

# --- Эндпоинты для работы с каналами ---

class ChannelPayload(BaseModel):
    username: str

@app.post("/channels")
async def save_channel_endpoint(payload: ChannelPayload):
    """Сохраняет канал в БД."""
    try:
        success = save_channel(payload.username)
        if success:
            return {"ok": True, "message": "Channel saved successfully."}
        else:
            return JSONResponse(status_code=400, content={"ok": False, "error": "Failed to save channel"})
    except Exception as e:
        print(f"Save channel endpoint error: {e}")
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.get("/channels/current")
async def get_current_channel_endpoint():
    """Получает текущий сохраненный канал."""
    try:
        channel = get_saved_channel()
        return {"ok": True, "channel": channel}
    except Exception as e:
        print(f"Get current channel endpoint error: {e}")
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.get("/channels/{username}/check")
async def check_channel_endpoint(username: str):
    """Проверяет, сохранен ли канал."""
    try:
        is_saved = is_channel_saved(username)
        return {"ok": True, "is_saved": is_saved}
    except Exception as e:
        print(f"Check channel endpoint error: {e}")
        return JSONResponse(status_code=500, content={"ok": False, "error": str(e)})

@app.delete("/channels/current")
async def delete_current_channel_endpoint():
    """Удаляет текущий сохраненный канал."""
    try:
        success = delete_saved_channel()
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
async def save_user_telegram_credentials_endpoint(payload: TelegramCredentialsPayload):
    """
    Сохраняет Telegram API credentials пользователя.
    Credentials шифруются перед сохранением в БД.
    """
    try:
        from app.crypto_utils import encrypt_string
        from app.supabase_manager import save_user_telegram_credentials
        
        user_identifier = _get_user_identifier(payload.user_identifier)
        
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
async def get_user_telegram_credentials_endpoint(user_identifier: str | None = None):
    """
    Проверяет наличие Telegram credentials у пользователя.
    Возвращает только факт наличия и API ID (без чувствительных данных).
    """
    try:
        from app.supabase_manager import get_user_telegram_credentials
        
        user_id = _get_user_identifier(user_identifier)
        credentials = get_user_telegram_credentials(user_id)
        
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
async def delete_user_telegram_credentials_endpoint(user_identifier: str | None = None):
    """Удаляет (деактивирует) Telegram credentials пользователя."""
    try:
        from app.supabase_manager import delete_user_telegram_credentials
        
        user_id = _get_user_identifier(user_identifier)
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
async def validate_telegram_credentials_endpoint(user_identifier: str | None = None):
    """
    Проверяет валидность сохраненных Telegram credentials,
    пытаясь подключиться к Telegram API.
    """
    try:
        from app.supabase_manager import get_user_telegram_credentials
        from app.crypto_utils import decrypt_string
        from telethon import TelegramClient
        from telethon.sessions import StringSession
        
        user_id = _get_user_identifier(user_identifier)
        credentials = get_user_telegram_credentials(user_id)
        
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
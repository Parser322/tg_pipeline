from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio
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

# Инициализируем Supabase при старте приложения
initialize_supabase()

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

async def run_pipeline_task(limit: int, period_hours: int | None = None, channel_url: str | None = None, is_top_posts: bool = False):
    """Обёртка для запуска задачи и управления состоянием."""
    global current_task
    set_running(True)
    try:
        print(f"Starting pipeline with limit: {limit}, channel: {channel_url or 'from config'}, top_posts: {is_top_posts}")
        await run_pipeline_main(limit=limit, period_hours=period_hours, channel_url=channel_url, is_top_posts=is_top_posts)
        print("Pipeline finished successfully.")
    except asyncio.CancelledError:
        print("Pipeline task was cancelled.")
    except Exception as e:
        print(f"An error occurred in pipeline: {e}")
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
    channel_url = data.get("channel_url")
    is_top_posts = data.get("is_top_posts", False)

    # Сбрасываем состояние перед новым запуском
    reset_state()
    
    task = asyncio.create_task(run_pipeline_task(
        limit=limit, 
        period_hours=period_hours,
        channel_url=channel_url,
        is_top_posts=is_top_posts
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
async def list_posts_endpoint():
    """Возвращает список всех сохраненных постов."""
    # Возвращаем посты с вложениями media[]
    posts = get_all_posts_with_media()
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
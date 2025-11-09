# main.py — ТЕКСТ + МЕДИА одним постом (альбомом), бережная склейка соседних сообщений
import os, asyncio, yaml, pathlib, shutil, subprocess
from datetime import datetime, timedelta
from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.errors import (
    FloodWaitError,
)
from telethon.sessions import StringSession
from PIL import Image
from app.state_manager import increment_processed, set_total, get_last_id, set_last_id
from app.supabase_manager import save_post, upload_media_files, save_post_media
# Убираем импорт, так как перевод здесь больше не нужен
# from app.translation import translate_text

# === 0. Ключи и конфиг ===
load_dotenv()

# Путь к config.yaml относительно app/
config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config.yaml")
with open(config_path, "r", encoding="utf-8") as f:
    CFG = yaml.safe_load(f)

# Целевой канал и доставка больше не нужны
# DEBUG_CFG = CFG.get("debug", {}) or {}
# MIRROR_TO_ME = bool(DEBUG_CFG.get("mirror_to_me", False))
OUT = pathlib.Path.home() / "Library" / "Caches" / "tg_pipeline"   # кэш, чтобы не засорять проект
OUT.mkdir(exist_ok=True, parents=True)

# Логика работы с state.json полностью заменена на Supabase через state_manager.py

# === 1. Помощники для медиа ===
def _ensure_telethon_session(session_base_path: str) -> None:
    """
    Если файла сессии нет, а переменная окружения TELEGRAM_SESSION_B64 передана,
    восстановим файл сессии из base64.
    """
    try:
        session_file = session_base_path + ".session"
        if pathlib.Path(session_file).exists():
            return
        b64 = os.getenv("TELEGRAM_SESSION_B64")
        if not b64:
            return
        import base64
        data = base64.b64decode(b64)
        with open(session_file, "wb") as f:
            f.write(data)
        print("Telethon session restored from TELEGRAM_SESSION_B64.")
    except Exception as e:
        print("Failed to restore Telethon session from env:", e)
def _get_telegram_credentials() -> tuple[int, str]:
    """
    Читает TELEGRAM_API_ID/TELEGRAM_API_HASH из окружения.
    Бросает понятную ошибку, если переменные не заданы.
    """
    api_id_str = os.getenv("TELEGRAM_API_ID")
    api_hash = os.getenv("TELEGRAM_API_HASH")
    if not api_id_str or not api_hash:
        raise RuntimeError(
            "Не заданы переменные окружения TELEGRAM_API_ID и/или TELEGRAM_API_HASH. "
            "Добавьте их в Railway → Variables и перезапустите."
        )
    return int(api_id_str), api_hash
def ffmpeg_exists() -> bool:
    return shutil.which("ffmpeg") is not None

def add_logo_image(img_path: str, logo_path: str, pos: str="bottom-right", margin: int=24) -> str:
    """Кладём логотип (если есть) и сохраняем в OUT. Возвращаем путь."""
    try:
        src = pathlib.Path(img_path)
        out = OUT / (src.stem + "_branded.png")
        if not pathlib.Path(logo_path).exists():
            Image.open(img_path).save(out); return str(out)
        img = Image.open(img_path).convert("RGBA")
        logo = Image.open(logo_path).convert("RGBA")
        scale = img.width * 0.15 / max(1, logo.width)
        logo = logo.resize((int(logo.width*scale), int(logo.height*scale)))
        x = margin if "left" in pos else img.width - logo.width - margin
        y = margin if "top" in pos else img.height - logo.height - margin
        img.alpha_composite(logo, dest=(x, y))
        img.save(out); return str(out)
    except Exception as e:
        print("Image branding error:", e)
        dst = OUT / pathlib.Path(img_path).name
        shutil.copy(img_path, dst); return str(dst)

def brand_video(video_path: str, logo_path: str) -> str:
    """Логотип на видео через ffmpeg (если есть), иначе просто переложим в OUT."""
    src = pathlib.Path(video_path)
    out = OUT / (src.stem + "_branded.mp4")
    if not ffmpeg_exists() or not pathlib.Path(logo_path).exists():
        dst = OUT / src.name
        if src.resolve() != dst.resolve(): shutil.move(str(src), str(dst))
        return str(dst)
    try:
        cmd = ["ffmpeg","-y","-i", str(video_path), "-i", logo_path,
               "-filter_complex","overlay=W-w-24:H-h-24","-codec:a","copy", str(out)]
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return str(out)
    except Exception as e:
        print("Video branding error:", e)
        dst = OUT / src.name
        if src.resolve() != dst.resolve(): shutil.move(str(src), str(dst))
        return str(dst)

async def download_and_brand(client, message):
    """Скачать медиа из сообщения и вернуть список путей к обработанным файлам."""
    paths = []
    if not message.media:
        return paths
    try:
        raw = await client.download_media(message)
        if raw:
            low = raw.lower()
            if low.endswith((".jpg",".jpeg",".png",".webp",".bmp",".tiff")):
                paths.append(add_logo_image(raw, CFG["logo"]["path"],
                                            CFG["logo"]["position"], CFG["logo"]["margin"]))
                try: os.remove(raw)
                except: pass
            elif low.endswith((".mp4",".mov",".mkv",".webm",".m4v")):
                paths.append(brand_video(raw, CFG["logo"]["path"]))
            else:
                dst = OUT / pathlib.Path(raw).name
                shutil.move(raw, dst); paths.append(str(dst))
    except Exception as e:
        print("Media download error:", e)
    return paths

# === 2a. Выбор топ-постов за период по метрикам ===
async def process_top_posts(client: TelegramClient, ch: str, period_days: float, top_counts: dict, desired_total: int | None = None):
    print(f"== Top posts mode: channel {ch}, period_days={period_days}, counts={top_counts}")
    entity = await client.get_entity(ch)
    # Поддерживаем дробные дни (например, 0.5 дня = 12 часов)
    days_span = max(0.001, float(period_days))
    since_dt = datetime.utcnow() - timedelta(days=days_span)

    # Собираем сообщения за период
    collected = []
    async for m in client.iter_messages(entity, limit=2000):
        if m.date.tzinfo:
            msg_dt = m.date.replace(tzinfo=None)
        else:
            msg_dt = m.date
        if msg_dt < since_dt:
            break

        # Считываем реакции и просмотры (если доступны)
        likes = 0
        comments = int(getattr(m, 'replies', None).replies if getattr(m, 'replies', None) else 0)
        views = int(getattr(m, 'views', 0) or 0)

        try:
            r = getattr(m, 'reactions', None)
            if r and getattr(r, 'results', None):
                for res in r.results:
                    emoji = getattr(res, 'reaction', None)
                    count = int(getattr(res, 'count', 0) or 0)
                    # Считаем любые реакции как лайки, либо фильтровать по \u2764\ufe0f
                    likes += count
        except Exception:
            pass

        collected.append({
            'message': m,
            'likes': likes,
            'comments': comments,
            'views': views,
        })

    print(f"Collected {len(collected)} messages in period for {ch}")

    # Сортировки и выбор топов с гарантией квот и без дублей
    def sorted_by(key: str):
        sorted_all = sorted(collected, key=lambda x: x.get(key, 0), reverse=True)
        positives = [x for x in sorted_all if x.get(key, 0) > 0]
        return positives if positives else sorted_all

    unique_ids = set()
    unique_msgs = []

    for key in ['likes', 'comments', 'views']:
        quota = int(top_counts.get(key, 0) or 0)
        if quota <= 0:
            continue
        count_added = 0
        for item in sorted_by(key):
            if count_added >= quota:
                break
            mid = item['message'].id
            if mid in unique_ids:
                continue
            unique_ids.add(mid)
            unique_msgs.append(item)
            count_added += 1

    print(f"Selected unique messages after quotas: {len(unique_msgs)}")

    # При наличии явного лимита с фронта — ограничим выдачу
    if isinstance(desired_total, int) and desired_total > 0:
        unique_msgs = unique_msgs[:desired_total]

    # Фолбэк: если ничего не набрали по метрикам, добираем просто свежие посты
    if not unique_msgs:
        print("Top selection produced 0 messages, applying fallback by date...")
        # сортируем по дате у исходных сообщений
        collected_sorted = sorted(collected, key=lambda x: x['message'].date, reverse=True)
        for item in collected_sorted:
            unique_msgs.append(item)
            if isinstance(desired_total, int) and desired_total > 0 and len(unique_msgs) >= desired_total:
                break

    # Второй фолбэк: если и после добора по периоду пусто, берём последние текстовые посты без ограничения периода
    if not unique_msgs:
        print("Fallback by date yielded 0 messages, expanding search window (ignore period)...")
        async for m2 in client.iter_messages(entity, limit=500):
            # Оборачиваем в совместимую структуру
            unique_msgs.append({
                'message': m2,
                'likes': 0,
                'comments': int(getattr(m2, 'replies', None).replies if getattr(m2, 'replies', None) else 0),
                'views': int(getattr(m2, 'views', 0) or 0),
            })

            if isinstance(desired_total, int) and desired_total > 0 and len(unique_msgs) >= desired_total:
                break
        
    print(f"Final messages to send: {len(unique_msgs)}")

    # Проставим total для прогресса
    set_total(len(unique_msgs))

    # Отправляем в целевой канал, соблюдая текущие правила склейки/медиа
    # Здесь без склейки; отправляем как есть
    for item in unique_msgs:
        m = item['message']
        caption = (m.message or "").strip()
        media_paths = await download_and_brand(client, m)
        
        # --- Собираем данные для сохранения в Supabase ---
        post_to_save = {
            "source_channel": ch,
            "original_message_id": m.id,
            "original_ids": [m.id],
            "original_date": m.date,
            "content": caption,
            "translated_content": None, # Будет заполнено позже
            "target_lang": None,      # Будет заполнено позже
            "has_media": bool(media_paths),
            "media_count": len(media_paths),
            "is_merged": False,
            "is_top_post": True,
            "original_views": item.get('views', 0),
            "original_likes": item.get('likes', 0),
            "original_comments": item.get('comments', 0),
        }
        post_id = save_post(post_to_save)
        if post_id and media_paths:
            media_items = upload_media_files(media_paths, ch, m.id)
            if media_items:
                save_post_media(post_id, media_items)

        # --- ОТПРАВКА В TELEGRAM ОТКЛЮЧЕНА ---
        print(f"Post id={m.id} saved to Supabase. Skipping Telegram send.")

        # Чистим кэш после сохранения
        for p in media_paths:
            try: pathlib.Path(p).unlink(missing_ok=True)
            except Exception as e: print("Cleanup error:", e)

        increment_processed()

# === 2. Основная логика ===
async def process_channel(client: TelegramClient, ch: str, limit: int):
    print(f"== Channel: {ch}")
    entity = await client.get_entity(ch)
    # last_id = get_last_id(ch) # Проверка на дубликаты отключена

    # Запрашиваем последние N постов без учета min_id
    all_msgs = [m async for m in client.iter_messages(entity, limit=limit*2)]  # Берём больше для фильтрации
    if not all_msgs:
        print(f"No messages found for {ch}")
        set_total(0)
        return

    # Больше не фильтруем видео/GIF — включаем любые сообщения
    msgs = all_msgs[:limit]
    set_total(len(msgs)) # Устанавливаем количество для обработки
    msgs.reverse()  # от старых к новым

    for m in msgs:
        # На каждой итерации даём возможность циклу событий обработать отмену
        await asyncio.sleep(0)

        # Сообщения уже отфильтрованы, дополнительная проверка не нужна

        text = (m.message or "").strip()
        media_paths = await download_and_brand(client, m)

        # --- Логика склейки полностью удалена ---

        # --- Собираем данные для сохранения в Supabase ---
        caption = (text or "").strip()

        post_to_save = {
            "source_channel": ch,
            "original_message_id": m.id,
            "original_ids": [m.id], # Теперь всегда один ID
            "original_date": m.date,
            "content": caption,
            "translated_content": None, # Будет заполнено позже
            "target_lang": None,      # Будет заполнено позже
            "has_media": bool(media_paths),
            "media_count": len(media_paths),
            "is_merged": False, # Склейка отключена
            "is_top_post": False,
            "original_views": m.views or 0,
        }
        
        # --- Сохраняем пост и медиа ---
        post_id = save_post(post_to_save)
        if post_id and media_paths:
            media_items = upload_media_files(media_paths, ch, m.id)
            if media_items:
                save_post_media(post_id, media_items)

        # --- ОТПРАВКА В TELEGRAM ОТКЛЮЧЕНА ---
        # Теперь только чистим кэш после сохранения
        for p in media_paths:
            try: pathlib.Path(p).unlink(missing_ok=True)
            except Exception as e: print("Cleanup error:", e)

        # Обновление last_id больше не требуется
        # current_last_id = get_last_id(ch)
        # set_last_id(ch, max(current_last_id, m.id))
        increment_processed() # Увеличиваем счетчик после успешной обработки

async def main(limit: int = 100, period_hours: int | None = None, channel_url: str | None = None, is_top_posts: bool = False):
    """Основная функция, теперь принимает лимит постов, канал и режим парсинга."""
    api_id, api_hash = _get_telegram_credentials()
    # Поддержка строковой сессии (предпочтительно для прод/CI)
    session_string = os.getenv("TELEGRAM_STRING_SESSION")
    if session_string:
        client = TelegramClient(StringSession(session_string), api_id, api_hash)
    else:
        # Путь к session файлу в backend/
        session_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "session")
        # Восстанавливаем сессию из env при необходимости
        _ensure_telethon_session(session_path)
        client = TelegramClient(session_path, api_id, api_hash)
    try:
        await client.start()
        me = await client.get_me()
        print(f"Started session as {me.username or me.first_name}.")
        
        # Определяем список каналов
        channels = [channel_url] if channel_url else CFG["channels"]
        
        # Определяем режим парсинга (топ посты или обычный)
        top_cfg = (CFG.get("top_posts") or {})
        enabled_top = is_top_posts or bool(top_cfg.get("enabled", False))
        
        if enabled_top:
            # Период из запроса в часах имеет приоритет над конфигом в днях
            period_days = int(top_cfg.get("period_days", 7))
            if period_hours is not None:
                # переводим часы в дни с плавающей точкой
                period_days = max(0.0417, float(period_hours) / 24.0)
            counts = top_cfg.get("top_by") or {"likes": 2, "comments": 2, "views": 2}
            for ch in channels:
                await process_top_posts(client, ch, period_days=period_days, top_counts=counts, desired_total=limit)
        else:
            for ch in channels:
                await process_channel(client, ch, limit=limit)
    except asyncio.CancelledError:
        print("Main task was cancelled. Disconnecting...")
        # Это исключение возникнет при нажатии "Остановить"
    finally:
        if client.is_connected():
            await client.disconnect()
        print("Done.")

if __name__ == "__main__":
    # Теперь при прямом запуске можно указать лимит
    asyncio.run(main(limit=100))

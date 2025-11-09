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

def group_messages_into_post_units(messages):
    """
    Группирует сообщения в единицы постов:
    - Сообщения с одинаковым grouped_id объединяются в один пост (альбом).
    - Обычные сообщения без grouped_id идут как отдельные посты.
    Порядок сохраняется как в исходном списке (обычно от новых к старым).
    """
    units = []
    if not messages:
        return units
    # Сгруппируем по grouped_id
    grouped_map = {}
    for msg in messages:
        gid = getattr(msg, "grouped_id", None)
        if gid:
            grouped_map.setdefault(gid, []).append(msg)
    seen_gids = set()
    seen_mids = set()
    for msg in messages:
        gid = getattr(msg, "grouped_id", None)
        if gid:
            if gid in seen_gids:
                continue
            seen_gids.add(gid)
            group = grouped_map.get(gid, [])
            # Стабильный порядок внутри альбома: по дате/ID возрастанию
            group_sorted = sorted(group, key=lambda x: (x.date, x.id))
            units.append(group_sorted)
            for m in group_sorted:
                seen_mids.add(m.id)
        else:
            if msg.id in seen_mids:
                continue
            units.append([msg])
            seen_mids.add(msg.id)
    return units

# === helpers: извлечение метрик и разбивок реакций ===
def _extract_message_metrics(msg):
    """
    Возвращает кортеж:
    - views: int
    - comments: int
    - likes_total: int (сумма всех реакций)
    - reactions_breakdown: dict[str, int]  (emoji -> count)
    """
    views = int(getattr(msg, "views", 0) or 0)
    comments = int(getattr(getattr(msg, "replies", None), "replies", 0) or 0)
    likes_total = 0
    reactions_breakdown = {}
    try:
        r = getattr(msg, "reactions", None)
        if r and getattr(r, "results", None):
            for res in r.results:
                react = getattr(res, "reaction", None)
                count = int(getattr(res, "count", 0) or 0)
                # Пытаемся получить смайлик (Unicode). Для кастомных эмодзи оставим метку custom:<id>
                emoji = None
                try:
                    emoji = getattr(react, "emoticon", None)
                except Exception:
                    emoji = None
                if not emoji:
                    # Попробуем document_id у кастомного эмодзи
                    try:
                        doc_id = getattr(react, "document_id", None)
                        if doc_id:
                            emoji = f"custom:{doc_id}"
                    except Exception:
                        pass
                if not emoji:
                    try:
                        emoji = str(react) if react is not None else None
                    except Exception:
                        emoji = None
                if not emoji:
                    emoji = "unknown"
                likes_total += count
                reactions_breakdown[emoji] = reactions_breakdown.get(emoji, 0) + count
    except Exception:
        pass
    return views, comments, likes_total, reactions_breakdown

def _merge_group_metrics(items):
    """
    На вход список словарей вида:
      { 'views': int, 'comments': int, 'likes': int, 'reactions': dict[emoji,int] }
    Агрегируем для альбомов как максимум по числовым метрикам и максимум по каждому эмодзи.
    (в Телеграме у сообщений альбома метрики обычно синхронизированы)
    """
    max_views = 0
    max_comments = 0
    max_likes = 0
    breakdown: dict[str, int] = {}
    for it in items:
        max_views = max(max_views, int(it.get("views", 0) or 0))
        max_comments = max(max_comments, int(it.get("comments", 0) or 0))
        max_likes = max(max_likes, int(it.get("likes", 0) or 0))
        for emoji, cnt in (it.get("reactions", {}) or {}).items():
            breakdown[emoji] = max(breakdown.get(emoji, 0), int(cnt or 0))
    return max_views, max_comments, max_likes, breakdown

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

        # Считываем просмотры, комментарии, лайки (сумма реакций) и разбивку по эмодзи
        views, comments, likes, reactions_breakdown = _extract_message_metrics(m)

        collected.append({
            'message': m,
            'likes': likes,
            'comments': comments,
            'views': views,
            'reactions': reactions_breakdown,
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

    # Проставим total для прогресса (учитываем альбомы как один пост)
    counted = set()
    total_units = 0
    for item in unique_msgs:
        m = item['message']
        gid = getattr(m, 'grouped_id', None)
        key = ("gid", gid) if gid else ("mid", m.id)
        if key in counted:
            continue
        counted.add(key)
        total_units += 1
    set_total(total_units)

    # Отправляем в целевой канал, соблюдая текущие правила склейки/медиа
    # Здесь без склейки; отправляем как есть
    used_album_keys = set()
    for item in unique_msgs:
        m = item['message']
        gid = getattr(m, 'grouped_id', None)
        album_key = ("gid", gid) if gid else ("mid", m.id)
        if album_key in used_album_keys:
            continue
        used_album_keys.add(album_key)

        # Собираем участников альбома из уже собранного пула за период
        if gid:
            group_members = [x['message'] for x in collected if getattr(x['message'], 'grouped_id', None) == gid]
        else:
            group_members = [m]
        # Порядок внутри группы — по дате/ID
        group_members = sorted(group_members, key=lambda x: (x.date, x.id))

        # Подпись — первая непустая среди группы (обычно у первого элемента альбома)
        caption = ""
        for gm in group_members:
            t = (gm.message or "").strip()
            if t:
                caption = t
                break

        # Скачиваем и брендируем все медиа из альбома
        media_paths = []
        for gm in group_members:
            media_paths.extend(await download_and_brand(client, gm))

        root_msg = group_members[0]
        root_id = root_msg.id
        original_ids = [gm.id for gm in group_members]

        # Для метрик возьмем максимум по группе (обычно одинаковы)
        ids_set = set(original_ids)
        metrics_to_merge = []
        for it in collected:
            mid = it['message'].id
            if mid in ids_set:
                metrics_to_merge.append({
                    "views": it.get("views", 0),
                    "comments": it.get("comments", 0),
                    "likes": it.get("likes", 0),
                    "reactions": it.get("reactions", {}) or {},
                })
        grouped_views, grouped_comments, grouped_likes, grouped_reactions = _merge_group_metrics(metrics_to_merge)

        # --- Собираем данные для сохранения в Supabase ---
        post_to_save = {
            "source_channel": ch,
            "original_message_id": root_id,
            "original_ids": original_ids,
            "original_date": root_msg.date,
            "content": caption,
            "translated_content": None, # Будет заполнено позже
            "target_lang": None,      # Будет заполнено позже
            "has_media": bool(media_paths),
            "media_count": len(media_paths),
            "is_merged": len(group_members) > 1,
            "is_top_post": True,
            "original_views": grouped_views,
            "original_likes": grouped_likes,
            "original_comments": grouped_comments,
            "original_reactions": grouped_reactions,
        }
        post_id = save_post(post_to_save)
        if post_id and media_paths:
            media_items = upload_media_files(media_paths, ch, root_id)
            if media_items:
                save_post_media(post_id, media_items)

        # --- ОТПРАВКА В TELEGRAM ОТКЛЮЧЕНА ---
        print(f"Post album_key={album_key} saved to Supabase. Skipping Telegram send.")

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

    # Запрашиваем последние сообщения без учета min_id
    all_msgs = [m async for m in client.iter_messages(entity, limit=limit*4)]  # Берём больше, чтобы не резать альбом
    if not all_msgs:
        print(f"No messages found for {ch}")
        set_total(0)
        return

    # Формируем единицы постов с учетом альбомов
    units = group_messages_into_post_units(all_msgs)
    selected_units = units[:limit]
    set_total(len(selected_units))  # считаем посты (альбомы), а не сообщения
    selected_units.reverse()  # от старых к новым

    for group in selected_units:
        # На каждой итерации даём возможность циклу событий обработать отмену
        await asyncio.sleep(0)

        # Стабильный порядок внутри группы
        group = sorted(group, key=lambda x: (x.date, x.id))

        # Подпись — первая непустая среди группы
        caption = ""
        for gm in group:
            t = (gm.message or "").strip()
            if t:
                caption = t
                break

        # Скачиваем и брендируем все медиа из группы
        media_paths = []
        for gm in group:
            media_paths.extend(await download_and_brand(client, gm))

        root_msg = group[0]
        root_id = root_msg.id
        original_ids = [gm.id for gm in group]

        # Собираем метрики по группе
        metrics_to_merge = []
        for gm in group:
            v, c, l, rmap = _extract_message_metrics(gm)
            metrics_to_merge.append({"views": v, "comments": c, "likes": l, "reactions": rmap})
        grouped_views, grouped_comments, grouped_likes, grouped_reactions = _merge_group_metrics(metrics_to_merge)

        post_to_save = {
            "source_channel": ch,
            "original_message_id": root_id,
            "original_ids": original_ids, # один или несколько ID альбома
            "original_date": root_msg.date,
            "content": caption,
            "translated_content": None, # Будет заполнено позже
            "target_lang": None,      # Будет заполнено позже
            "has_media": bool(media_paths),
            "media_count": len(media_paths),
            "is_merged": len(group) > 1,
            "is_top_post": False,
            "original_views": grouped_views,
            "original_likes": grouped_likes,
            "original_comments": grouped_comments,
            "original_reactions": grouped_reactions,
        }
        
        # --- Сохраняем пост и медиа ---
        post_id = save_post(post_to_save)
        if post_id and media_paths:
            media_items = upload_media_files(media_paths, ch, root_id)
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
    # Поддержка строковой сессии (предпочтительно для прод/CI) + безопасный фолбэк
    session_string = os.getenv("TELEGRAM_STRING_SESSION")
    session_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "session")
    # Попробуем восстановить файловую сессию из TELEGRAM_SESSION_B64 (если задана)
    _ensure_telethon_session(session_path)

    client = None
    session_mode = "file"
    if session_string:
        try:
            client = TelegramClient(StringSession(session_string), api_id, api_hash)
            session_mode = "string"
        except Exception as e:
            # Ошибка при создании StringSession — откатываемся на файл
            print(f"Invalid TELEGRAM_STRING_SESSION ({e}). Falling back to file session.")
            client = TelegramClient(session_path, api_id, api_hash)
            session_mode = "file"
    else:
        client = TelegramClient(session_path, api_id, api_hash)
        session_mode = "file"
    try:
        try:
            await client.start()
        except Exception as e:
            # Частый сценарий: переменная TELEGRAM_STRING_SESSION из другой библиотеки
            # (ошибка наподобие 'unpack requires a buffer of N bytes'). Пробуем фолбэк.
            if session_mode == "string":
                print(f"Failed to start with TELEGRAM_STRING_SESSION: {e}. Trying file/B64 session...")
                try:
                    if client.is_connected():
                        await client.disconnect()
                except Exception:
                    pass
                client = TelegramClient(session_path, api_id, api_hash)
                await client.start()
            else:
                raise
        me = await client.get_me()
        print(f"Started session as {me.username or me.first_name}.")
        
        # Определяем список каналов
        channels = [channel_url] if channel_url else CFG["channels"]
        
        # Определяем режим парсинга (только по флагу с фронта)
        top_cfg = (CFG.get("top_posts") or {})
        enabled_top = bool(is_top_posts)
        
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

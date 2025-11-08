# state_manager.py
# Фасад для управления состоянием пайплайна в Supabase.

from typing import Dict, Any

from app.supabase_manager import get_state_document, update_state, set_state

DEFAULT_STATE = {
    "processed": 0,
    "total": 0,
    "is_running": False,
    "finished": False,
    "channels": {} # Для хранения last_id по каждому каналу
}

def get_state():
    """Возвращает текущее состояние из Supabase, или состояние по умолчанию."""
    state = get_state_document()
    # Убедимся, что все ключи из DEFAULT_STATE присутствуют
    return {**DEFAULT_STATE, **(state or {})}

def reset_state():
    """Сбрасывает состояние прогресса в Supabase, но сохраняет last_id каналов."""
    current_state = get_state()
    new_state = {
        **current_state, # Сохраняем существующие значения, включая 'channels'
        "processed": 0,
        "total": 0,
        "is_running": False,
        "finished": False,
    }
    set_state(new_state)

def set_running(running: bool):
    """Устанавливает флаг, что процесс запущен или остановлен."""
    updates = {"is_running": running}
    if running:
        updates["finished"] = False
    update_state(updates)

def set_finished(finished: bool):
    """Устанавливает флаг, что процесс завершен."""
    update_state({"finished": finished})

def increment_processed():
    """Увеличивает счетчик обработанных постов в Supabase."""
    state = get_state()
    processed = int(state.get("processed", 0)) + 1
    update_state({"processed": processed})

def set_total(total: int):
    """Устанавливает общее количество постов для обработки."""
    update_state({"total": total})

def get_last_id(channel: str) -> int:
    """Получает последний обработанный ID для указанного канала."""
    state = get_state()
    return state.get("channels", {}).get(channel, 0)

def set_last_id(channel: str, last_id: int):
    """Обновляет последний обработанный ID для канала."""
    # Используем "точечную нотацию" для обновления вложенного поля
    update_key = f"channels.{channel}"
    update_state({update_key: last_id})

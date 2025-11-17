# state_manager.py
# Фасад для управления состоянием пайплайна в Supabase с поддержкой multi-user.

from typing import Dict, Any

from app.supabase_manager import get_state_document, update_state, set_state

DEFAULT_STATE = {
    "processed": 0,
    "total": 0,
    "is_running": False,
    "finished": False,
    "channels": {} # Для хранения last_id по каждому каналу
}

# Кэш для processed count по пользователям (обновляется только при чтении из БД)
_processed_cache: Dict[str, int] = {}

def get_state(user_id: str) -> Dict[str, Any]:
    """
    Возвращает текущее состояние пайплайна для конкретного пользователя.
    
    Args:
        user_id: UUID пользователя
        
    Returns:
        Словарь с состоянием
    """
    global _processed_cache
    state = get_state_document(user_id)
    result = {**DEFAULT_STATE, **(state or {})}
    # Обновляем кэш при чтении
    _processed_cache[user_id] = int(result.get("processed", 0))
    return result

def reset_state(user_id: str):
    """
    Сбрасывает состояние прогресса для конкретного пользователя, но сохраняет last_id каналов.
    
    Args:
        user_id: UUID пользователя
    """
    global _processed_cache
    current_state = get_state(user_id)
    new_state = {
        **current_state, # Сохраняем существующие значения, включая 'channels'
        "processed": 0,
        "total": 0,
        "is_running": False,
        "finished": False,
    }
    set_state(user_id, new_state)
    _processed_cache[user_id] = 0

def set_running(user_id: str, running: bool):
    """
    Устанавливает флаг, что процесс запущен или остановлен для конкретного пользователя.
    
    Args:
        user_id: UUID пользователя
        running: Флаг запущенности
    """
    updates = {"is_running": running}
    if running:
        updates["finished"] = False
    update_state(user_id, updates)

def set_finished(user_id: str, finished: bool):
    """
    Устанавливает флаг, что процесс завершен для конкретного пользователя.
    
    Args:
        user_id: UUID пользователя
        finished: Флаг завершенности
    """
    update_state(user_id, {"finished": finished})

def increment_processed(user_id: str):
    """
    Увеличивает счетчик обработанных постов для конкретного пользователя.
    Оптимизировано: использует кэш вместо чтения из БД каждый раз.
    
    Args:
        user_id: UUID пользователя
    """
    global _processed_cache
    if user_id not in _processed_cache:
        _processed_cache[user_id] = 0
    _processed_cache[user_id] += 1
    update_state(user_id, {"processed": _processed_cache[user_id]})

def set_total(user_id: str, total: int):
    """
    Устанавливает общее количество постов для обработки для конкретного пользователя.
    
    Args:
        user_id: UUID пользователя
        total: Общее количество постов
    """
    update_state(user_id, {"total": total})

def get_last_id(user_id: str, channel: str) -> int:
    """
    Получает последний обработанный ID для указанного канала конкретного пользователя.
    
    Args:
        user_id: UUID пользователя
        channel: Имя канала
        
    Returns:
        Последний обработанный ID
    """
    state = get_state(user_id)
    return state.get("channels", {}).get(channel, 0)

def set_last_id(user_id: str, channel: str, last_id: int):
    """
    Обновляет последний обработанный ID для канала конкретного пользователя.
    
    Args:
        user_id: UUID пользователя
        channel: Имя канала
        last_id: ID последнего сообщения
    """
    # Используем "точечную нотацию" для обновления вложенного поля
    update_key = f"channels.{channel}"
    update_state(user_id, {update_key: last_id})

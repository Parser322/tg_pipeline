#!/usr/bin/env python3
"""
Утилита для сброса застрявшего состояния парсера.
Используйте, если парсер завис и is_running осталось true.
"""

import sys
import os

# Добавляем путь к app
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
from app.supabase_manager import initialize_supabase, update_state, get_state_document

load_dotenv()

def main():
    print("Инициализация подключения к Supabase...")
    try:
        initialize_supabase()
    except Exception as e:
        print(f"ОШИБКА: Не удалось подключиться к Supabase: {e}")
        return 1
    
    print("\nТекущее состояние:")
    state = get_state_document()
    print(f"  processed: {state.get('processed')}")
    print(f"  total: {state.get('total')}")
    print(f"  is_running: {state.get('is_running')}")
    print(f"  finished: {state.get('finished')}")
    
    if not state.get('is_running'):
        print("\nСостояние уже корректное (is_running = False)")
        return 0
    
    print("\nСбрасываю флаг is_running...")
    update_state({
        "is_running": False,
        "finished": True
    })
    
    print("\nНовое состояние:")
    state = get_state_document()
    print(f"  processed: {state.get('processed')}")
    print(f"  total: {state.get('total')}")
    print(f"  is_running: {state.get('is_running')}")
    print(f"  finished: {state.get('finished')}")
    
    print("\n✅ Состояние успешно сброшено!")
    return 0

if __name__ == "__main__":
    sys.exit(main())


"""
Модуль для шифрования/дешифрования чувствительных данных.
Используется Fernet (симметричное шифрование) из библиотеки cryptography.
"""

import os
import base64
from cryptography.fernet import Fernet
from typing import Optional


def _get_encryption_key() -> bytes:
    """
    Получает ключ шифрования из переменной окружения.
    Если ключа нет, генерирует новый (только для dev/demo).
    
    В production ОБЯЗАТЕЛЬНО должен быть установлен CREDENTIALS_ENCRYPTION_KEY!
    """
    key_str = os.getenv("CREDENTIALS_ENCRYPTION_KEY")
    
    if not key_str:
        # В production это должно быть ошибкой!
        print("⚠️  WARNING: CREDENTIALS_ENCRYPTION_KEY not set! Using temporary key.")
        print("⚠️  This is INSECURE for production. Set CREDENTIALS_ENCRYPTION_KEY env variable!")
        
        # Генерируем временный ключ для demo
        # В production раскомментируйте эту строку:
        # raise ValueError("CREDENTIALS_ENCRYPTION_KEY environment variable must be set!")
        
        temp_key = Fernet.generate_key()
        return temp_key
    
    try:
        # Декодируем ключ из base64
        return base64.urlsafe_b64decode(key_str.encode())
    except Exception as e:
        raise ValueError(f"Invalid CREDENTIALS_ENCRYPTION_KEY format: {e}")


def encrypt_string(plaintext: str) -> str:
    """
    Шифрует строку с использованием Fernet.
    
    Args:
        plaintext: Исходная строка для шифрования
        
    Returns:
        Зашифрованная строка в формате base64
    """
    if not plaintext:
        return ""
    
    try:
        key = _get_encryption_key()
        f = Fernet(key)
        encrypted_bytes = f.encrypt(plaintext.encode('utf-8'))
        # Возвращаем в base64 для удобного хранения в БД
        return base64.urlsafe_b64encode(encrypted_bytes).decode('utf-8')
    except Exception as e:
        raise RuntimeError(f"Encryption failed: {e}")


def decrypt_string(encrypted_text: str) -> str:
    """
    Дешифрует строку, зашифрованную с помощью encrypt_string.
    
    Args:
        encrypted_text: Зашифрованная строка в формате base64
        
    Returns:
        Расшифрованная исходная строка
    """
    if not encrypted_text:
        return ""
    
    try:
        key = _get_encryption_key()
        f = Fernet(key)
        
        # Декодируем из base64 обратно в байты
        encrypted_bytes = base64.urlsafe_b64decode(encrypted_text.encode('utf-8'))
        
        # Дешифруем
        decrypted_bytes = f.decrypt(encrypted_bytes)
        return decrypted_bytes.decode('utf-8')
    except Exception as e:
        raise RuntimeError(f"Decryption failed: {e}")


def generate_encryption_key() -> str:
    """
    Генерирует новый ключ шифрования.
    Используйте эту функцию для генерации CREDENTIALS_ENCRYPTION_KEY.
    
    Returns:
        Ключ шифрования в формате base64 (готов для использования в .env)
        
    Example:
        >>> key = generate_encryption_key()
        >>> print(f"CREDENTIALS_ENCRYPTION_KEY={key}")
    """
    key = Fernet.generate_key()
    return base64.urlsafe_b64encode(key).decode('utf-8')


def verify_encryption(test_string: str = "test_data_12345") -> bool:
    """
    Проверяет, что шифрование/дешифрование работает корректно.
    
    Args:
        test_string: Тестовая строка для проверки
        
    Returns:
        True если шифрование работает корректно, False иначе
    """
    try:
        encrypted = encrypt_string(test_string)
        decrypted = decrypt_string(encrypted)
        return decrypted == test_string
    except Exception as e:
        print(f"Encryption verification failed: {e}")
        return False


if __name__ == "__main__":
    # Для генерации нового ключа запустите:
    # python -m app.crypto_utils
    print("Generating new encryption key...")
    print(f"\nAdd this to your .env file:")
    print(f"CREDENTIALS_ENCRYPTION_KEY={generate_encryption_key()}")
    print("\n⚠️  Keep this key secret and never commit it to git!")


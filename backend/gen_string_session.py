from telethon.sync import TelegramClient
from telethon.sessions import StringSession

api_id = 21443509           # ваш API_ID
api_hash = "8c7b9261a8511438a95c10df37e91b54"  # ваш API_HASH

with TelegramClient(StringSession(), api_id, api_hash) as client:
    client.start()  # здесь введите телефон, затем код (и пароль 2FA, если есть)
    print(client.session.save())

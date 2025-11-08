FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

# Системные зависимости (ffmpeg для брендинга видео; безопасно, если не нужен)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Установка зависимостей
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && \
    pip install -r /app/requirements.txt

# Копируем исходники backend (включая config.yaml и session файлы)
COPY app /app/app
COPY config.yaml /app/config.yaml
COPY session.session /app/session.session
COPY session.session.bak /app/session.session.bak

EXPOSE 8000

# Railway предоставляет переменную PORT — укажем её uvicorn
CMD ["sh", "-c", "uvicorn app.web:app --host 0.0.0.0 --port ${PORT:-8000}"]



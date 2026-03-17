# RYExchange Mini App

Telegram Mini App для обменника. Работает поверх существующих баз данных бота.

## Структура

```
miniapp/
├── backend/          # FastAPI (Python)
│   ├── main.py       # API endpoints
│   ├── .env.example  # Скопируй в .env и заполни
│   └── requirements.txt
└── frontend/         # React + Tailwind CSS
    ├── src/
    │   ├── pages/    # Calculator, Cabinet, Moderator
    │   ├── hooks/    # useTelegram, useApi
    │   └── App.jsx
    └── package.json
```

## Запуск бэкенда

```bash
cd miniapp/backend
cp .env.example .env   # заполни BOT_TOKEN и MODERATOR_IDS
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Запуск фронтенда

```bash
cd miniapp/frontend
npm install
npm run dev
```

## Production (сборка)

```bash
cd miniapp/frontend
npm run build
# Папка dist/ — отдай её через nginx или caddy
```

## Переменные окружения (.env)

| Переменная     | Описание                          |
|----------------|-----------------------------------|
| BOT_TOKEN      | Токен Telegram-бота               |
| MODERATOR_IDS  | ID модераторов через запятую      |

## Подключение к боту

В BotFather выполни: `/newapp` → укажи URL развёрнутого фронтенда.
В боте добавь кнопку: `web_app=WebAppInfo(url="https://your-domain.com")`
